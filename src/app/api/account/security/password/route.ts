import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hash, compare } from "bcryptjs";
import { z } from "zod";
import { consumeRateLimit, getCurrentUser, sameOriginRequest, SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ currentPassword: z.string().min(1).max(72), newPassword: z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72) });

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to update your password." }, { status: 401 });
  if (!await consumeRateLimit(request, "password-change", user.id, 5, 60 * 60 * 1000)) return NextResponse.json({ error: "Too many password-change attempts. Try again later." }, { status: 429 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "New password must contain 12 to 72 characters." }, { status: 400 });
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!account || !await compare(parsed.data.currentPassword, account.passwordHash)) return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Sign in again before changing your password." }, { status: 401 });
  const currentTokenHash = createHash("sha256").update(token).digest("hex");
  const passwordHash = await hash(parsed.data.newPassword, 12);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await tx.userSession.updateMany({ where: { userId: user.id, revokedAt: null, tokenHash: { not: currentTokenHash } }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({ data: { actorUserId: user.id, action: "account.password_changed", entityType: "User", entityId: user.id } });
  });
  return NextResponse.json({ ok: true });
}
