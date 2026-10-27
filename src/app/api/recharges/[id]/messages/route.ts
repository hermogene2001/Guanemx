import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit, getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) });

async function getAccessibleRequest(id: string, userId: string, role: string) {
  const recharge = await prisma.rechargeRequest.findUnique({ where: { id }, select: { id: true, userId: true, assignedAgentId: true } });
  if (!recharge) return null;
  const allowed = role === "ADMIN"
    || (role === "AGENT" && recharge.assignedAgentId === userId)
    || (role === "USER" && recharge.userId === userId);
  return allowed ? recharge : null;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to open this recharge chat." }, { status: 401 });
  const { id } = await params;
  const recharge = await getAccessibleRequest(id, user.id, user.role);
  if (!recharge) return NextResponse.json({ error: "Recharge request was not found." }, { status: 404 });
  const messages = await prisma.rechargeMessage.findMany({
    where: { rechargeRequestId: id }, orderBy: { createdAt: "desc" }, take: 100,
    include: { sender: { select: { id: true, name: true, role: true } } },
  });
  return NextResponse.json({ messages: messages.reverse().map((message) => ({
    id: message.id, body: message.body, createdAt: message.createdAt.toISOString(), sender: message.sender,
  })) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to send a chat message." }, { status: 401 });
  if (!await consumeRateLimit(request, "recharge-chat", user.id, 30, 60 * 60 * 1000)) return NextResponse.json({ error: "You have reached the chat message limit. Try again later." }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid message body." }, { status: 400 }); }
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Messages must contain 1 to 2,000 characters." }, { status: 400 });

  const { id } = await params;
  try {
    const message = await prisma.$transaction(async (tx) => {
      const recharge = await tx.rechargeRequest.findUnique({ where: { id }, select: { userId: true, assignedAgentId: true, status: true } });
      if (!recharge) throw new Error("NOT_FOUND");
      const allowed = user.role === "ADMIN"
        || (user.role === "AGENT" && recharge.assignedAgentId === user.id)
        || (user.role === "USER" && recharge.userId === user.id);
      if (!allowed) throw new Error("NOT_FOUND");
      if (recharge.status !== "PENDING") throw new Error("CHAT_CLOSED");
      return tx.rechargeMessage.create({
        data: { rechargeRequestId: id, senderId: user.id, body: parsed.data.body },
        include: { sender: { select: { id: true, name: true, role: true } } },
      });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ message: { id: message.id, body: message.body, createdAt: message.createdAt.toISOString(), sender: message.sender } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return NextResponse.json({ error: "Recharge request was not found." }, { status: 404 });
    if (error instanceof Error && error.message === "CHAT_CLOSED") return NextResponse.json({ error: "This recharge chat is closed because the request is no longer pending." }, { status: 409 });
    console.error(JSON.stringify({ event: "recharge_chat_send_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Message could not be sent." }, { status: 500 });
  }
}
