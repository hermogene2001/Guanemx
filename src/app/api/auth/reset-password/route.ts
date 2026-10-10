import { NextRequest, NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { hash } from "bcryptjs";
import { z } from "zod";
import { consumeRateLimit, sameOriginRequest } from "@/lib/auth";
import { recordAudit } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { consumeVerificationToken } from "@/lib/verification-tokens";

const schema = z.object({
  token: z.string().trim().min(20).max(512),
  password: z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72),
});

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  if (!await consumeRateLimit(request, "password-reset", "all", 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many password-reset attempts. Try again later." }, { status: 429 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose a new password with at least 12 characters." }, { status: 400 });

  const outcome = await consumeVerificationToken("reset-password", parsed.data.token);
  if (!outcome) return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: outcome.userId }, select: { id: true, status: true } });
  if (!user || user.status === UserStatus.SUSPENDED) return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });

  const passwordHash = await hash(parsed.data.password, 12);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await tx.userSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await recordAudit(tx, request, user.id, "account.password_reset", "User", user.id);
  });
  return NextResponse.json({ ok: true, next: "/login" });
}
