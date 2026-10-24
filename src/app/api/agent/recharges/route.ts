import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "AGENT" && user.role !== "ADMIN")) return NextResponse.json({ error: "Agent access is required." }, { status: 403 });
  const requests = await prisma.rechargeRequest.findMany({
    where: user.role === "ADMIN" ? { status: "PENDING" } : { assignedAgentId: user.id, status: "PENDING" },
    orderBy: { createdAt: "asc" }, take: 100,
    include: { user: { select: { name: true, email: true, phone: true } } },
  });
  return NextResponse.json({ requests: requests.map((item) => ({ id: item.id, amount: item.amount.toFixed(0), currency: item.currency, createdAt: item.createdAt.toISOString(), paymentMethod: item.paymentMethod, cryptoName: item.cryptoName, cryptoNetwork: item.cryptoNetwork, cryptoAddress: item.cryptoAddress, client: item.user })) });
}
