import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/finance";

const instructionsSchema = z.object({ instructions: z.string().trim().min(1).max(1500) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const sender = await getCurrentUser();
  if (!sender || (sender.role !== "AGENT" && sender.role !== "ADMIN")) return NextResponse.json({ error: "Agent access is required." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = instructionsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter payment instructions of up to 1,500 characters." }, { status: 400 });

  const { id } = await params;
  try {
    const sentAt = new Date();
    await prisma.$transaction(async (tx) => {
      const recharge = await tx.rechargeRequest.findUnique({ where: { id }, select: { id: true, status: true, assignedAgentId: true } });
      if (!recharge || (sender.role !== "ADMIN" && recharge.assignedAgentId !== sender.id)) throw new Error("NOT_ASSIGNED");
      if (recharge.status !== "PENDING") throw new Error("ALREADY_REVIEWED");

      const updated = await tx.rechargeRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { paymentInstructions: parsed.data.instructions, instructionsSentAt: sentAt, instructionsSenderId: sender.id },
      });
      if (updated.count !== 1) throw new Error("ALREADY_REVIEWED");
      await recordAudit(tx, request, sender.id, "recharge.instructions_sent", "RechargeRequest", id, { characterCount: parsed.data.instructions.length, senderRole: sender.role });
    });
    return NextResponse.json({ sentAt: sentAt.toISOString(), sender: { name: sender.name, role: sender.role } });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_ASSIGNED") return NextResponse.json({ error: "Recharge request was not found or is assigned to another agent." }, { status: 404 });
    if (error instanceof Error && error.message === "ALREADY_REVIEWED") return NextResponse.json({ error: "This recharge request is no longer pending." }, { status: 409 });
    console.error(JSON.stringify({ event: "recharge_instructions_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Payment instructions could not be sent." }, { status: 500 });
  }
}
