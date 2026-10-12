import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { CURRENCY } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { settleDueEarnings } from "@/lib/robot-earnings";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your wallet." }, { status: 401 });
  await settleDueEarnings(user.id);
  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ wallet: {
    currency: wallet?.currency ?? CURRENCY,
    mainBalance: wallet?.availableBalance.toFixed(2) ?? "0.00",
    pendingBalance: wallet?.pendingBalance.toFixed(2) ?? "0.00",
    growthBalance: wallet?.growthBalance.toFixed(2) ?? "0.00",
  } });
}
