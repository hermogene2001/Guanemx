import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit, getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const messageSchema = z.object({ body: z.string().trim().min(1).max(4000) });

async function generalRoom() {
  return prisma.communityRoom.upsert({ where: { name: "General" }, create: { name: "General", description: "GuanemX community discussion" }, update: {} });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view the community." }, { status: 401 });
  const room = await generalRoom();
  const messages = await prisma.communityMessage.findMany({ where: { roomId: room.id, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100, include: { author: { select: { id: true, name: true, role: true } } } });
  return NextResponse.json({ room: { id: room.id, name: room.name }, messages: messages.reverse().map((item) => ({ id: item.id, body: item.body, createdAt: item.createdAt.toISOString(), author: item.author, reported: Boolean(item.reportedAt) })) });
}

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to post a message." }, { status: 401 });
  if (!await consumeRateLimit(request, "community-message", user.id, 10, 60 * 60 * 1000)) return NextResponse.json({ error: "You have reached the message limit. Try again later." }, { status: 429 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Messages must contain 1 to 4,000 characters." }, { status: 400 });
  const room = await generalRoom();
  const message = await prisma.communityMessage.create({ data: { roomId: room.id, authorId: user.id, body: parsed.data.body } });
  return NextResponse.json({ id: message.id, createdAt: message.createdAt.toISOString() }, { status: 201 });
}
