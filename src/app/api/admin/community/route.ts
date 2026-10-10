import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { recordAudit } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

const actionSchema = z.object({ messageId: z.string().min(1), action: z.enum(["remove", "restore", "dismiss"]) });

export async function GET() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const messages = await prisma.communityMessage.findMany({
    where: { OR: [{ reportedAt: { not: null } }, { deletedAt: { not: null } }] },
    orderBy: [{ reportedAt: "desc" }, { createdAt: "desc" }], take: 100,
    include: { author: { select: { name: true, email: true } } },
  });
  return NextResponse.json({ messages: messages.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), reportedAt: item.reportedAt?.toISOString() ?? null, deletedAt: item.deletedAt?.toISOString() ?? null })) });
}

export async function PATCH(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid moderation action." }, { status: 400 });
  const { messageId, action } = parsed.data;
  const existing = await prisma.communityMessage.findUnique({ where: { id: messageId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Message not found." }, { status: 404 });
  await prisma.$transaction(async (tx) => {
    await tx.communityMessage.update({ where: { id: messageId }, data: action === "remove"
      ? { deletedAt: new Date() }
      : action === "restore" ? { deletedAt: null, reportedAt: null } : { reportedAt: null } });
    await recordAudit(tx, request, admin.id, `community.message_${action}`, "CommunityMessage", messageId);
  });
  return NextResponse.json({ ok: true });
}
