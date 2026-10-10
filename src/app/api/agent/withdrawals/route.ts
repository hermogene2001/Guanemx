import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { decryptPayoutAccountNumber } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "AGENT" && user.role !== "ADMIN")) return NextResponse.json({ error: "Agent access is required." }, { status: 403 });
  const items = await prisma.withdrawal.findMany({
    where: user.role === "ADMIN" ? { status: "PENDING" } : { assignedAgentId: user.id, status: "PENDING" },
    orderBy: { createdAt: "asc" }, take: 100,
    include: {
      transaction: { select: { id: true, userId: true, amount: true, currency: true, reference: true, createdAt: true, user: { select: { name: true, email: true, phone: true } } } },
      payoutDestination: { select: { category: true, provider: true, accountHolder: true, accountNumberEncrypted: true, accountNumberLast4: true } },
    },
  });
  return NextResponse.json({ withdrawals: items.map((item) => ({
    id: item.id, status: item.status, amount: item.transaction.amount.toFixed(0), currency: item.transaction.currency,
    fee: item.fee.toFixed(2), netPayout: item.netPayout.toFixed(2), sourceBalance: item.sourceBalance,
    reference: item.transaction.reference, createdAt: item.transaction.createdAt.toISOString(), client: item.transaction.user,
    destination: item.payoutDestination ? {
      category: item.payoutDestination.category, provider: item.payoutDestination.provider,
      accountHolder: item.payoutDestination.accountHolder,
      accountNumber: decryptPayoutAccountNumber(item.payoutDestination.accountNumberEncrypted),
      accountNumberLast4: item.payoutDestination.accountNumberLast4,
    } : null,
  })) });
}
