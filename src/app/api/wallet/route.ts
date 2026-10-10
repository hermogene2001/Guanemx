import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your wallet." }, { status: 401 });
  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ wallet: {
    currency: wallet?.currency ?? "RWF",
    mainBalance: wallet?.availableBalance.toFixed(2) ?? "0.00",
    pendingBalance: wallet?.pendingBalance.toFixed(2) ?? "0.00",
    growthBalance: wallet?.growthBalance.toFixed(2) ?? "0.00",
  } });
}
