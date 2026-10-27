import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/finance";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to cancel this recharge." }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.$transaction(async (tx) => {
      const recharge = await tx.rechargeRequest.findUnique({ where: { id }, select: { userId: true, status: true } });
      if (!recharge || recharge.userId !== user.id) throw new Error("NOT_FOUND");
      if (recharge.status !== "PENDING") throw new Error("NOT_PENDING");

      const cancelled = await tx.rechargeRequest.updateMany({ where: { id, userId: user.id, status: "PENDING" }, data: { status: "CANCELLED" } });
      if (cancelled.count !== 1) throw new Error("NOT_PENDING");
      await recordAudit(tx, request, user.id, "recharge.cancelled", "RechargeRequest", id);
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ status: "CANCELLED" });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return NextResponse.json({ error: "Recharge request was not found." }, { status: 404 });
    if (error instanceof Error && error.message === "NOT_PENDING") return NextResponse.json({ error: "This recharge can no longer be cancelled." }, { status: 409 });
    console.error(JSON.stringify({ event: "recharge_cancel_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Recharge request could not be cancelled." }, { status: 500 });
  }
}
