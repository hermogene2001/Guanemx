import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { consumeRateLimit, getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { kigaliDayStart, newReference, recordAudit } from "@/lib/finance";
import { CURRENCY } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getPlatformSettings } from "@/lib/settings";

const withdrawalSchema = z.object({
  amount: z.number().int().min(1).max(3_000_000),
  sourceBalance: z.enum(["MAIN", "GROWTH"]),
  payoutDestinationId: z.string().min(1).max(40),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view withdrawals." }, { status: 401 });
  const withdrawals = await prisma.withdrawal.findMany({
    where: { transaction: { userId: user.id } }, orderBy: { createdAt: "desc" }, take: 50,
    include: { transaction: { select: { amount: true, currency: true, createdAt: true, reference: true } }, payoutDestination: { select: { category: true, provider: true, accountHolder: true, accountNumberLast4: true } } },
  });
  return NextResponse.json({ withdrawals: withdrawals.map((item) => ({
    id: item.id, status: item.status, amount: item.transaction.amount.toFixed(0), currency: item.transaction.currency,
    fee: item.fee.toFixed(2), netPayout: item.netPayout.toFixed(2), sourceBalance: item.sourceBalance,
    createdAt: item.createdAt.toISOString(), reference: item.transaction.reference,
    destination: item.payoutDestination ? { category: item.payoutDestination.category, provider: item.payoutDestination.provider, accountHolder: item.payoutDestination.accountHolder, accountNumberLast4: item.payoutDestination.accountNumberLast4 } : null,
  })) });
}

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in before requesting a withdrawal." }, { status: 401 });
  if (!await consumeRateLimit(request, "withdrawal-request", user.id, 5, 60 * 60 * 1000)) return NextResponse.json({ error: "Too many withdrawal requests. Try again later." }, { status: 429 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = withdrawalSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a whole-dollar withdrawal no greater than $3,000,000 and choose a balance and payout destination." }, { status: 400 });
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey || idempotencyKey.length > 100) return NextResponse.json({ error: "A valid request key is required." }, { status: 400 });

  try {
    const agentId = await prisma.user.findFirst({ where: { role: "AGENT", status: "ACTIVE" }, select: { id: true } });
    if (!agentId) return NextResponse.json({ error: "Withdrawals are temporarily unavailable. No active review agents are configured." }, { status: 503 });
    const destination = await prisma.payoutDestination.findFirst({ where: { id: parsed.data.payoutDestinationId, userId: user.id }, select: { id: true } });
    if (!destination) return NextResponse.json({ error: "Choose one of your saved payout destinations." }, { status: 400 });

    const amount = new Prisma.Decimal(parsed.data.amount);
    const result = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.transaction.findUnique({ where: { idempotencyKey }, include: { withdrawal: true } });
      if (duplicate) {
        if (duplicate.userId !== user.id || !duplicate.withdrawal) throw new Error("REQUEST_KEY_IN_USE");
        return { withdrawal: duplicate.withdrawal, transaction: duplicate, repeated: true };
      }
      const settings = await getPlatformSettings(tx);
      if (amount.lt(settings.minimumWithdrawalAmount)) throw new Error(`BELOW_MINIMUM:${settings.minimumWithdrawalAmount.toFixed(0)}`);
      const fee = amount.mul(settings.withdrawalFeePercent).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
      const netPayout = amount.sub(fee);
      const now = new Date();
      const start = kigaliDayStart(now);
      if (new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Africa/Kigali" }).format(now) !== "Fri") {
        throw new Error("FRIDAY_ONLY");
      }
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      const priorFriday = await tx.withdrawal.findFirst({
        where: { transaction: { userId: user.id, createdAt: { gte: start, lt: end } } },
        select: { id: true },
      });
      if (priorFriday) throw new Error("WEEKLY_LIMIT");
      const wallet = await tx.wallet.upsert({ where: { userId: user.id }, create: { userId: user.id, currency: CURRENCY }, update: {} });
      const before = parsed.data.sourceBalance === "MAIN" ? wallet.availableBalance : wallet.growthBalance;
      if (before.lt(amount)) throw new Error("INSUFFICIENT_BALANCE");
      const after = before.sub(amount);
      await tx.wallet.update({ where: { id: wallet.id }, data: parsed.data.sourceBalance === "MAIN" ? { availableBalance: after } : { growthBalance: after } });
      const transaction = await tx.transaction.create({ data: {
        userId: user.id, type: "WITHDRAWAL", status: "PENDING", amount, currency: CURRENCY,
        reference: newReference("WDR"), idempotencyKey,
        description: `Gross withdrawal request from ${parsed.data.sourceBalance === "MAIN" ? "Main Balance" : "Growth Balance"}`,
      } });
      const withdrawal = await tx.withdrawal.create({ data: {
        transactionId: transaction.id, destinationToken: destination.id, payoutDestinationId: destination.id,
        assignedAgentId: agentId.id, sourceBalance: parsed.data.sourceBalance, fee, netPayout,
      } });
      await tx.walletLedger.create({ data: {
        walletId: wallet.id, transactionId: transaction.id, entryType: "WITHDRAWAL", balanceType: parsed.data.sourceBalance,
        amount: amount.negated(), currency: CURRENCY, balanceBefore: before, balanceAfter: after, reference: transaction.reference,
      } });
      await recordAudit(tx, request, user.id, "withdrawal.requested", "Withdrawal", withdrawal.id, {
        amount: parsed.data.amount, fee: fee.toFixed(2), feePercent: settings.withdrawalFeePercent.toFixed(2), netPayout: netPayout.toFixed(2), sourceBalance: parsed.data.sourceBalance,
      });
      return { withdrawal, transaction, repeated: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ id: result.withdrawal.id, repeated: result.repeated, status: result.withdrawal.status, amount: result.transaction.amount.toFixed(0), fee: result.withdrawal.fee.toFixed(2), netPayout: result.withdrawal.netPayout.toFixed(2) }, { status: result.repeated ? 200 : 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "FRIDAY_ONLY") return NextResponse.json({ error: "Withdrawals are available on Fridays only (Kigali time)." }, { status: 409 });
    if (error instanceof Error && error.message === "WEEKLY_LIMIT") return NextResponse.json({ error: "You can submit only one withdrawal request per Friday (Kigali time)." }, { status: 409 });
    if (error instanceof Error && error.message.startsWith("BELOW_MINIMUM:")) return NextResponse.json({ error: `The minimum withdrawal is ${CURRENCY} ${error.message.slice("BELOW_MINIMUM:".length)}.` }, { status: 400 });
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") return NextResponse.json({ error: "The selected balance is lower than the requested gross amount." }, { status: 409 });
    if (error instanceof Error && error.message === "REQUEST_KEY_IN_USE") return NextResponse.json({ error: "Request key already used." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "This withdrawal request has already been submitted." }, { status: 409 });
    console.error(JSON.stringify({ event: "withdrawal_request_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Withdrawal request could not be created. Please try again." }, { status: 500 });
  }
}
