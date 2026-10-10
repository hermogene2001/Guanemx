import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit, getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { recordAudit } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to report a message." }, { status: 401 });
  if (!await consumeRateLimit(request, "community-report", user.id, 20, 24 * 60 * 60 * 1000)) return NextResponse.json({ error: "You have reached the message report limit. Try again later." }, { status: 429 });
  const { id } = await context.params;
  const message = await prisma.communityMessage.findUnique({ where: { id }, select: { id: true, authorId: true, deletedAt: true, reportedAt: true } });
  if (!message || message.deletedAt) return NextResponse.json({ error: "Message not found." }, { status: 404 });
  if (message.authorId === user.id) return NextResponse.json({ error: "You cannot report your own message." }, { status: 400 });
  if (message.reportedAt) return NextResponse.json({ error: "This message has already been reported." }, { status: 409 });
  await prisma.$transaction(async (tx) => {
    await tx.communityMessage.update({ where: { id }, data: { reportedAt: new Date() } });
    await recordAudit(tx, request, user.id, "community.message_reported", "CommunityMessage", id);
  });
  return NextResponse.json({ ok: true });
}
