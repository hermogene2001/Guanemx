import { Prisma } from "@prisma/client";
import { newReference } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
const ROBOT_EARNINGS_JOB = "robot-daily-earnings";

export function getNextRobotEarningDueAt(startAt: Date, daysCompleted: number) {
  return new Date(startAt.getTime() + (daysCompleted + 1) * DAY_MS);
}

export function calculateDailyEarning(investment: Prisma.Decimal.Value, dailyReturnPercentage: Prisma.Decimal.Value) {
  return new Prisma.Decimal(investment)
    .mul(dailyReturnPercentage)
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

type CreditResult = "credited" | "not-due" | "skipped";

async function creditOneDay(subscriptionId: string, now: Date): Promise<CreditResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const subscription = await tx.subscription.findUnique({
          where: { id: subscriptionId },
          include: {
            robot: { select: { id: true, name: true, status: true } },
            robotPlan: { select: { durationDays: true } },
          },
        });
        if (!subscription || subscription.status !== "ACTIVE" || subscription.robot.status !== "ACTIVE") return "skipped";

        const nextDay = subscription.daysCompleted + 1;
        if (!subscription.startAt || nextDay > subscription.robotPlan.durationDays) return "skipped";
        const scheduledAt = getNextRobotEarningDueAt(subscription.startAt, subscription.daysCompleted);
        if (scheduledAt > now) return "not-due";

        const earning = calculateDailyEarning(subscription.price, subscription.dailyReturnPercentage);
        if (earning.lessThanOrEqualTo(0)) throw new Error("Daily earning rounds to zero; increase the plan price or daily return percentage.");

        const completesPlan = nextDay >= subscription.robotPlan.durationDays;
        const advanced = await tx.subscription.updateMany({
          where: { id: subscription.id, status: "ACTIVE", daysCompleted: subscription.daysCompleted },
          data: {
            daysCompleted: { increment: 1 },
            lastCreditedAt: scheduledAt,
            ...(completesPlan ? { status: "EXPIRED" } : {}),
          },
        });
        if (advanced.count !== 1) return "skipped";

        const wallet = await tx.wallet.findUnique({ where: { userId: subscription.userId } });
        if (!wallet) throw new Error(`Wallet not found for subscription ${subscription.id}.`);
        const balanceAfter = wallet.availableBalance.plus(earning);
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { availableBalance: { increment: earning } },
        });

        const idempotencyKey = `robot-earning:${subscription.id}:${nextDay}`;
        const transaction = await tx.transaction.create({
          data: {
            userId: subscription.userId,
            robotId: subscription.robotId,
            subscriptionId: subscription.id,
            type: "ROBOT_EARNING",
            status: "COMPLETED",
            amount: earning,
            currency: subscription.currency,
            reference: newReference("RBE"),
            idempotencyKey,
            description: `${subscription.robot.name} daily earning (${nextDay}/${subscription.robotPlan.durationDays})`,
          },
        });
        await tx.walletLedger.create({
          data: {
            walletId: wallet.id,
            transactionId: transaction.id,
            entryType: "ROBOT_EARNING",
            balanceType: "MAIN",
            amount: earning,
            currency: subscription.currency,
            balanceBefore: wallet.availableBalance,
            balanceAfter,
            reference: transaction.reference,
          },
        });
        return "credited";
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error(`Could not serialize daily earning credit for subscription ${subscriptionId}.`);
}

async function processSubscription(subscriptionId: string, now: Date) {
  let processed = 0;
  while (true) {
    const state = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { id: true, daysCompleted: true, robotPlan: { select: { durationDays: true } } },
    });
    if (!state || state.daysCompleted >= state.robotPlan.durationDays) break;
    const result = await creditOneDay(subscriptionId, now);
    if (result !== "credited") break;
    processed += 1;
  }
  return processed;
}

export async function runRobotEarnings(now = new Date()) {
  const run = await prisma.cronJobRun.create({ data: { job: ROBOT_EARNINGS_JOB, status: "RUNNING" } });
  console.log(JSON.stringify({ event: "robot_earnings_job_started", runId: run.id, startedAt: run.startedAt.toISOString() }));
  let processedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  try {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        dailyReturnPercentage: { gt: 0 },
        robot: { status: "ACTIVE" },
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    for (const subscription of subscriptions) {
      try {
        processedCount += await processSubscription(subscription.id, now);
      } catch (error) {
        failedCount += 1;
        const message = error instanceof Error ? error.message : "Unknown error";
        errors.push(`${subscription.id}: ${message}`.slice(0, 500));
        console.error(JSON.stringify({ event: "robot_earning_credit_failed", subscriptionId: subscription.id, message }));
      }
    }

    const completedAt = new Date();
    const status = failedCount === 0 ? "COMPLETED" : "FAILED";
    const errorSummary = errors.length ? errors.join("\n").slice(0, 4000) : null;
    await prisma.cronJobRun.update({
      where: { id: run.id },
      data: { status, completedAt, processedCount, failedCount, errorSummary },
    });
    console.log(JSON.stringify({ event: "robot_earnings_job_finished", runId: run.id, status, processedCount, failedCount, completedAt: completedAt.toISOString() }));
    return { runId: run.id, status, processedCount, failedCount, completedAt, errorSummary };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(JSON.stringify({ event: "robot_earnings_job_failed", runId: run.id, message }));
    await prisma.cronJobRun.update({
      where: { id: run.id },
      data: { status: "FAILED", completedAt: new Date(), processedCount, failedCount: failedCount + 1, errorSummary: message.slice(0, 4000) },
    });
    throw error;
  }
}
