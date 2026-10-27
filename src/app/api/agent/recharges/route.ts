import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "AGENT" && user.role !== "ADMIN")) return NextResponse.json({ error: "Agent access is required." }, { status: 403 });
  const requests = await prisma.rechargeRequest.findMany({
    where: user.role === "ADMIN" ? { status: "PENDING" } : { assignedAgentId: user.id, status: "PENDING" },
    orderBy: { createdAt: "asc" }, take: 100,
    select: {
      id: true, amount: true, currency: true, createdAt: true, paymentMethod: true, cryptoName: true, cryptoNetwork: true, cryptoAddress: true,
      paymentInstructions: true, instructionsSentAt: true, proofContentType: true, proofFileName: true, proofUploadedAt: true,
      user: { select: { name: true, email: true, phone: true } },
      instructionsSender: { select: { name: true, role: true } },
    },
  });
  const preferences = await prisma.user.findUnique({ where: { id: user.id }, select: { rechargeInstructionsTemplate: true } });
  return NextResponse.json({ reusableInstructions: preferences?.rechargeInstructionsTemplate ?? null, requests: requests.map((item) => ({ id: item.id, amount: item.amount.toFixed(0), currency: item.currency, createdAt: item.createdAt.toISOString(), paymentMethod: item.paymentMethod, cryptoName: item.cryptoName, cryptoNetwork: item.cryptoNetwork, cryptoAddress: item.cryptoAddress, paymentInstructions: item.paymentInstructions, instructionsSentAt: item.instructionsSentAt?.toISOString() ?? null, instructionsSender: item.instructionsSender, proofContentType: item.proofContentType, proofFileName: item.proofFileName, proofUploadedAt: item.proofUploadedAt?.toISOString() ?? null, client: item.user })) });
}
