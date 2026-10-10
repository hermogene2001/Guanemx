import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { newReference, recordAudit } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

const reviewSchema = z.object({ action: z.enum(["approve", "reject"]), reason: z.string().trim().max(500).optional() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const reviewer = await getCurrentUser();
  if (!reviewer || (reviewer.role !== "AGENT" && reviewer.role !== "ADMIN")) return NextResponse.json({ error: "Agent access is required." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose approve or reject." }, { status: 400 });
  const { id } = await params;

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.findUnique({ where: { id }, include: { transaction: true } });
      if (!withdrawal || (reviewer.role !== "ADMIN" && withdrawal.assignedAgentId !== reviewer.id)) throw new Error("NOT_ASSIGNED");
      if (withdrawal.status !== "PENDING") throw new Error("ALREADY_REVIEWED");
      const userId = withdrawal.transaction.userId;
      const amount = withdrawal.transaction.amount;
      const now = new Date();
      if (parsed.data.action === "reject") {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) throw new Error("WALLET_NOT_FOUND");
        const before = withdrawal.sourceBalance === "MAIN" ? wallet.availableBalance : wallet.growthBalance;
        const after = before.add(amount);
        await tx.wallet.update({ where: { id: wallet.id }, data: withdrawal.sourceBalance === "MAIN" ? { availableBalance: after } : { growthBalance: after } });
        const refund = await tx.transaction.create({ data: {
          userId, type: "REFUND", status: "COMPLETED", amount, currency: withdrawal.transaction.currency,
          reference: newReference("WRF"), description: `Rejected withdrawal returned to ${withdrawal.sourceBalance === "MAIN" ? "Main Balance" : "Growth Balance"}`,
        } });
        await tx.walletLedger.create({ data: {
          walletId: wallet.id, transactionId: refund.id, entryType: "REFUND", balanceType: withdrawal.sourceBalance,
          amount, currency: refund.currency, balanceBefore: before, balanceAfter: after, reference: refund.reference,
        } });
        await tx.transaction.update({ where: { id: withdrawal.transactionId }, data: { status: "REJECTED" } });
        await tx.withdrawal.update({ where: { id }, data: { status: "REJECTED", reviewReason: parsed.data.reason || null, reviewedById: reviewer.id, processedAt: now } });
        await recordAudit(tx, request, reviewer.id, "withdrawal.rejected", "Withdrawal", id, { amountRwf: amount.toFixed(2), reason: parsed.data.reason || null });
        return { status: "REJECTED", returnedAmount: amount.toFixed(2) };
      }

      await tx.withdrawal.update({ where: { id }, data: { status: "APPROVED", reviewReason: parsed.data.reason || null, reviewedById: reviewer.id } });
      await tx.transaction.update({ where: { id: withdrawal.transactionId }, data: { status: "COMPLETED", description: "Gross amount debited from balance; net payout and fee breakdown recorded separately." } });
      const payout = await tx.transaction.create({ data: {
        userId, type: "WITHDRAWAL", status: "PROCESSING", amount: withdrawal.netPayout, currency: withdrawal.transaction.currency,
        reference: newReference("PAY"), description: "Approved net payout recorded for manual payment; gross was already deducted at request time.",
      } });
      const fee = await tx.transaction.create({ data: {
        userId, type: "FEE", status: "COMPLETED", amount: withdrawal.fee, currency: withdrawal.transaction.currency,
        reference: newReference("FEE"), description: "10% withdrawal service fee; included in the gross withdrawal deduction.",
      } });
      await recordAudit(tx, request, reviewer.id, "withdrawal.approved", "Withdrawal", id, {
        grossRwf: amount.toFixed(2), netPayoutRwf: withdrawal.netPayout.toFixed(2), feeRwf: withdrawal.fee.toFixed(2),
        payoutTransactionId: payout.id, feeTransactionId: fee.id, manualPayoutRequired: true,
      });
      return { status: "APPROVED", netPayout: withdrawal.netPayout.toFixed(2), fee: withdrawal.fee.toFixed(2), manualPayoutRequired: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json(outcome);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_ASSIGNED") return NextResponse.json({ error: "Withdrawal was not found or is assigned to another agent." }, { status: 404 });
    if (error instanceof Error && error.message === "ALREADY_REVIEWED") return NextResponse.json({ error: "This withdrawal has already been reviewed." }, { status: 409 });
    console.error(JSON.stringify({ event: "withdrawal_review_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Withdrawal review could not be completed." }, { status: 500 });
  }
}
