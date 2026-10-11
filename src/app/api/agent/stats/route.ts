import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { kigaliDayStart } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "AGENT" && user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Agent access is required." }, { status: 403 });
  }

  const assigned = user.role === "ADMIN" ? {} : { assignedAgentId: user.id };
  const todayStart = kigaliDayStart();

  const [
    pendingRecharges,
    pendingWithdrawals,
    todayReviewed,
    totalRechargesReviewed,
    totalWithdrawalsReviewed,
  ] = await Promise.all([
    prisma.rechargeRequest.count({ where: { ...assigned, status: "PENDING" } }),
    prisma.withdrawal.count({ where: { ...assigned, status: "PENDING" } }),
    prisma.auditLog.count({
      where: {
        actorUserId: user.id,
        action: { in: ["recharge.confirmed", "recharge.rejected", "withdrawal.approved", "withdrawal.rejected"] },
        createdAt: { gte: todayStart },
      },
    }),
    prisma.rechargeRequest.count({ where: { reviewedById: user.id } }),
    prisma.withdrawal.count({ where: { reviewedById: user.id } }),
  ]);

  return NextResponse.json({
    pendingRecharges,
    pendingWithdrawals,
    todayReviewed,
    totalRechargesReviewed,
    totalWithdrawalsReviewed,
  });
}
