import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { decryptPayoutAccountNumber } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "AGENT" && user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Agent access is required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const PAGE = 20;

  // Reviewed recharges
  const recharges = await prisma.rechargeRequest.findMany({
    where: { reviewedById: user.id, status: { in: ["CONFIRMED", "REJECTED"] } },
    orderBy: { reviewedAt: "desc" },
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  const hasMore = recharges.length > PAGE;
  const page = recharges.slice(0, PAGE);

  const items = page.map((r) => ({
    kind: "recharge" as const,
    id: r.id,
    status: r.status,
    amount: r.amount.toFixed(0),
    currency: r.currency,
    reviewReason: r.reviewReason,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    client: { name: r.user.name, email: r.user.email },
  }));

  // Reviewed withdrawals (separately fetched, no cursor-join possible across models)
  const withdrawals = await prisma.withdrawal.findMany({
    where: { reviewedById: user.id, status: { in: ["APPROVED", "REJECTED"] } },
    orderBy: { processedAt: "desc" },
    take: PAGE,
    include: {
      transaction: {
        select: { amount: true, currency: true, reference: true, createdAt: true, user: { select: { name: true, email: true } } },
      },
      payoutDestination: {
        select: { provider: true, category: true, accountHolder: true, accountNumberEncrypted: true, accountNumberLast4: true },
      },
    },
  });

  const withdrawalItems = withdrawals.map((w) => ({
    kind: "withdrawal" as const,
    id: w.id,
    status: w.status,
    amount: w.transaction.amount.toFixed(0),
    currency: w.transaction.currency,
    fee: w.fee.toFixed(2),
    netPayout: w.netPayout.toFixed(2),
    sourceBalance: w.sourceBalance,
    reference: w.transaction.reference,
    reviewReason: w.reviewReason,
    reviewedAt: w.processedAt?.toISOString() ?? null,
    createdAt: w.transaction.createdAt.toISOString(),
    client: { name: w.transaction.user.name, email: w.transaction.user.email },
    destination: w.payoutDestination
      ? {
          provider: w.payoutDestination.provider,
          category: w.payoutDestination.category,
          accountHolder: w.payoutDestination.accountHolder,
          accountNumber: decryptPayoutAccountNumber(w.payoutDestination.accountNumberEncrypted),
          accountNumberLast4: w.payoutDestination.accountNumberLast4,
        }
      : null,
  }));

  // Merge and sort by reviewedAt desc
  const merged = [...items, ...withdrawalItems].sort((a, b) => {
    const aTime = a.reviewedAt ? new Date(a.reviewedAt).getTime() : 0;
    const bTime = b.reviewedAt ? new Date(b.reviewedAt).getTime() : 0;
    return bTime - aTime;
  });

  return NextResponse.json({
    items: merged,
    nextCursor: hasMore ? page[page.length - 1]?.id : null,
  });
}
