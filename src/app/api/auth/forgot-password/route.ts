import { NextRequest, NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { z } from "zod";
import { consumeRateLimit, sameOriginRequest } from "@/lib/auth";
import { sendMail, verificationLink } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { createVerificationToken, RESET_PASSWORD_TTL_MS } from "@/lib/verification-tokens";

const schema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const email = parsed.data.email.toLowerCase();

  const ipAllowed = await consumeRateLimit(request, "forgot-password-ip", "all", 10, 60 * 60 * 1000);
  const emailAllowed = await consumeRateLimit(request, "forgot-password-email", email, 5, 60 * 60 * 1000);
  if (!ipAllowed || !emailAllowed) return NextResponse.json({ error: "Too many password-reset requests. Try again later." }, { status: 429 });

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, status: true } });
  if (user && user.status !== UserStatus.SUSPENDED) {
    const token = await prisma.$transaction(async (tx) => {
      const issued = await createVerificationToken(tx, user.id, "reset-password", RESET_PASSWORD_TTL_MS);
      await tx.auditLog.create({ data: { actorUserId: user.id, action: "account.password_reset_requested", entityType: "User", entityId: user.id } });
      return issued;
    });
    await sendMail({
      to: email,
      subject: "Reset your GuanemX password",
      text: `A password reset was requested for your GuanemX account. Open this link within 1 hour to choose a new password:\n\n${verificationLink("reset-password", token)}\n\nIf you did not request this, you can ignore this message.`,
    });
  }
  // The response is identical whether or not the account exists (no enumeration).
  return NextResponse.json({ ok: true });
}