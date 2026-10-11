import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { newReference, recordAudit } from "@/lib/finance";
import { CURRENCY } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getPlatformSettings } from "@/lib/settings";

const reviewSchema = z.object({ action: z.enum(["confirm", "reject"]), reason: z.string().trim().max(500).optional() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const reviewer = await getCurrentUser();
  if (!reviewer || (reviewer.role !== "AGENT" && reviewer.role !== "ADMIN")) return NextResponse.json({ error: "Agent access is required." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose confirm or reject." }, { status: 400 });
  const { id } = await params;
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const recharge = await tx.rechargeRequest.findUnique({ where: { id }, include: { user: { select: { id: true, invitedById: true } } } });
      if (!recharge || (reviewer.role !== "ADMIN" && recharge.assignedAgentId !== reviewer.id)) throw new Error("NOT_ASSIGNED");
      if (recharge.status !== "PENDING") throw new Error("ALREADY_REVIEWED");
      const now = new Date();
      if (parsed.data.action === "reject") {
        const updated = await tx.rechargeRequest.update({ where: { id }, data: { status: "REJECTED", reviewReason: parsed.data.reason || null, reviewedById: reviewer.id, reviewedAt: now } });
        await recordAudit(tx, request, reviewer.id, "recharge.rejected", "RechargeRequest", id, { reason: parsed.data.reason || null });
        return { status: updated.status, creditedAmount: "0", referralBonus: "0" };
      }
      const wallet = await tx.wallet.upsert({ where: { userId: recharge.userId }, create: { userId: recharge.userId, currency: CURRENCY }, update: {} });
      const amount = recharge.amount;
      const before = wallet.availableBalance;
      const after = before.add(amount);
      await tx.wallet.update({ where: { id: wallet.id }, data: { availableBalance: after } });
      const transaction = await tx.transaction.create({ data: {
        userId: recharge.userId, type: "DEPOSIT", status: "COMPLETED", amount, currency: CURRENCY,
        reference: newReference("RCH"), description: "Agent-confirmed manual recharge",
      } });
      await tx.walletLedger.create({ data: {
        walletId: wallet.id, transactionId: transaction.id, entryType: "DEPOSIT", balanceType: "MAIN",
        amount, currency: CURRENCY, balanceBefore: before, balanceAfter: after, reference: transaction.reference,
      } });
      await tx.rechargeRequest.update({ where: { id }, data: { status: "CONFIRMED", reviewedById: reviewer.id, reviewedAt: now, transactionId: transaction.id } });

      let bonusText = "0.00";
      const { referralBonusPercent: bonusPercent } = await getPlatformSettings(tx);
      if (recharge.user.invitedById && bonusPercent.gt(0)) {
        const bonus = amount.mul(bonusPercent).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
        if (bonus.gt(0)) {
          const inviterWallet = await tx.wallet.upsert({ where: { userId: recharge.user.invitedById }, create: { userId: recharge.user.invitedById, currency: CURRENCY }, update: {} });
          const inviterBefore = inviterWallet.availableBalance;
          const inviterAfter = inviterBefore.add(bonus);
          await tx.wallet.update({ where: { id: inviterWallet.id }, data: { availableBalance: inviterAfter } });
          const bonusTransaction = await tx.transaction.create({ data: {
            userId: recharge.user.invitedById, type: "REFERRAL_BONUS", status: "COMPLETED", amount: bonus, currency: CURRENCY,
            reference: newReference("REF"), description: `Configured recharge referral bonus (${bonusPercent.toFixed(2)}%)`,
          } });
          await tx.walletLedger.create({ data: {
            walletId: inviterWallet.id, transactionId: bonusTransaction.id, entryType: "REFERRAL_BONUS", balanceType: "MAIN",
            amount: bonus, currency: CURRENCY, balanceBefore: inviterBefore, balanceAfter: inviterAfter, reference: bonusTransaction.reference,
          } });
          bonusText = bonus.toFixed(2);
        }
      }
      await recordAudit(tx, request, reviewer.id, "recharge.confirmed", "RechargeRequest", id, { amount: amount.toFixed(2), referralBonus: bonusText, referralBonusPercent: bonusPercent.toFixed(2) });
      return { status: "CONFIRMED", creditedAmount: amount.toFixed(2), referralBonus: bonusText };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json(outcome);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_ASSIGNED") return NextResponse.json({ error: "Recharge request was not found or is assigned to another agent." }, { status: 404 });
    if (error instanceof Error && error.message === "ALREADY_REVIEWED") return NextResponse.json({ error: "This recharge request has already been reviewed." }, { status: 409 });
    console.error(JSON.stringify({ event: "recharge_review_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Recharge review could not be completed." }, { status: 500 });
  }
}
