import { NextRequest, NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { z } from "zod";
import { sameOriginRequest } from "@/lib/auth";
import { recordAudit } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { consumeVerificationToken } from "@/lib/verification-tokens";

const schema = z.object({ token: z.string().trim().min(20).max(512) });

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "The verification link is invalid." }, { status: 400 });

  const outcome = await consumeVerificationToken("verify-email", parsed.data.token);
  if (!outcome) return NextResponse.json({ error: "This verification link is invalid or has expired." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: outcome.userId } });
  if (!user || user.status === UserStatus.SUSPENDED) return NextResponse.json({ error: "This verification link is invalid or has expired." }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { status: UserStatus.ACTIVE, emailVerifiedAt: new Date() } });
    await recordAudit(tx, request, user.id, "account.email_verified", "User", user.id);
  });
  return NextResponse.json({ ok: true, next: "/account" });
}