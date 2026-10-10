import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserStatus } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { newReference, recordAudit } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

const checkoutSchema = z.object({ planId: z.string().min(1).max(64), idempotencyKey: z.string().uuid() });

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to subscribe to a robot." }, { status: 401 });
  if (user.status !== UserStatus.ACTIVE) return NextResponse.json({ error: "Your account must be verified and active before subscribing." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid plan and retry checkout." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const previous = await tx.subscription.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey }, include: { robot: { select: { name: true } }, robotPlan: { select: { name: true } } } });
      if (previous) {
        if (previous.userId !== user.id) return { kind: "conflict" as const };
        return { kind: "success" as const, subscription: previous, replayed: true };
      }

      const plan = await tx.robotPlan.findFirst({
        where: { id: parsed.data.planId, status: "ACTIVE", robot: { status: "ACTIVE" } },
        include: { robot: { select: { id: true, name: true } } },
      });
      if (!plan) return { kind: "unavailable" as const };
      if (plan.currency !== "RWF") return { kind: "currency" as const };

      const wallet = await tx.wallet.findUnique({ where: { userId: user.id } });
      if (!wallet || wallet.currency !== plan.currency) return { kind: "wallet" as const };
      const price = new Prisma.Decimal(plan.price);
      const newBalance = wallet.availableBalance.minus(price);
      const changed = await tx.wallet.updateMany({
        where: { id: wallet.id, availableBalance: { gte: price } },
        data: { availableBalance: { decrement: price } },
      });
      if (changed.count !== 1) return { kind: "insufficient" as const };

      const now = new Date();
      const expiresAt = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
      const transaction = await tx.transaction.create({ data: {
        userId: user.id,
        type: "SUBSCRIPTION",
        status: "COMPLETED",
        amount: price,
        currency: plan.currency,
        reference: newReference("SUB"),
        idempotencyKey: parsed.data.idempotencyKey,
        description: `${plan.robot.name} · ${plan.name} subscription`,
      } });
      const subscription = await tx.subscription.create({
        data: {
          userId: user.id,
          robotId: plan.robot.id,
          robotPlanId: plan.id,
          idempotencyKey: parsed.data.idempotencyKey,
          status: "ACTIVE",
          price,
          currency: plan.currency,
          startAt: now,
          expiresAt,
        },
        include: { robot: { select: { name: true } }, robotPlan: { select: { name: true } } },
      });
      await tx.walletLedger.create({ data: {
        walletId: wallet.id,
        transactionId: transaction.id,
        entryType: "SUBSCRIPTION",
        balanceType: "MAIN",
        amount: price.negated(),
        currency: plan.currency,
        balanceBefore: wallet.availableBalance,
        balanceAfter: newBalance,
        reference: transaction.reference,
      } });
      await recordAudit(tx, request, user.id, "subscription.purchased", "Subscription", subscription.id, {
        robotId: plan.robot.id, robotPlanId: plan.id, price: price.toFixed(2), currency: plan.currency,
      });
      return { kind: "success" as const, subscription, replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.kind === "insufficient") return NextResponse.json({ error: "Your Main Balance does not cover this plan. Recharge your wallet and try again." }, { status: 409 });
    if (result.kind === "unavailable") return NextResponse.json({ error: "This plan is no longer available." }, { status: 404 });
    if (result.kind === "currency") return NextResponse.json({ error: "This plan uses a currency that checkout does not support." }, { status: 409 });
    if (result.kind === "wallet") return NextResponse.json({ error: "Your RWF wallet is not available. Contact support." }, { status: 409 });
    if (result.kind === "conflict") return NextResponse.json({ error: "This checkout key was already used." }, { status: 409 });
    return NextResponse.json({
      subscription: {
        id: result.subscription.id,
        status: result.subscription.status,
        robot: result.subscription.robot.name,
        plan: result.subscription.robotPlan.name,
        price: result.subscription.price.toFixed(2),
        currency: result.subscription.currency,
        startAt: result.subscription.startAt?.toISOString() ?? null,
        expiresAt: result.subscription.expiresAt?.toISOString() ?? null,
      },
      replayed: result.replayed,
    }, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) {
      const previous = await prisma.subscription.findUnique({
        where: { idempotencyKey: parsed.data.idempotencyKey },
        include: { robot: { select: { name: true } }, robotPlan: { select: { name: true } } },
      });
      if (previous?.userId === user.id) return NextResponse.json({
        subscription: {
          id: previous.id, status: previous.status, robot: previous.robot.name, plan: previous.robotPlan.name,
          price: previous.price.toFixed(2), currency: previous.currency,
          startAt: previous.startAt?.toISOString() ?? null, expiresAt: previous.expiresAt?.toISOString() ?? null,
        },
        replayed: true,
      });
      return NextResponse.json({ error: "Checkout conflicted with another wallet operation. Refresh your wallet and retry." }, { status: 409 });
    }
    console.error(JSON.stringify({ event: "robot_subscription_checkout_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Checkout could not be completed." }, { status: 500 });
  }
}
