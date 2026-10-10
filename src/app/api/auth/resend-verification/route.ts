import { NextRequest, NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { z } from "zod";
import { consumeRateLimit, sameOriginRequest } from "@/lib/auth";
import { sendMail, verificationLink } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { createVerificationToken, VERIFY_EMAIL_TTL_MS } from "@/lib/verification-tokens";

const schema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  const [ipAllowed, emailAllowed] = await Promise.all([
    consumeRateLimit(request, "resend-verification-ip", "all", 10, 60 * 60 * 1000),
    consumeRateLimit(request, "resend-verification-email", email, 4, 60 * 60 * 1000),
  ]);
  if (!ipAllowed || !emailAllowed) return NextResponse.json({ error: "Too many verification requests. Try again later." }, { status: 429 });

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, status: true } });
  if (user?.status === UserStatus.PENDING_VERIFICATION) {
    const token = await prisma.$transaction((tx) => createVerificationToken(tx, user.id, "verify-email", VERIFY_EMAIL_TTL_MS));
    try {
      await sendMail({ to: email, subject: "Verify your GuanemX email", text: `Verify your GuanemX email using this link:\n\n${verificationLink("verify-email", token)}\n\nThis link is valid for 24 hours.` });
    } catch (error) {
      console.error(JSON.stringify({ event: "verification_email_delivery_failed", message: error instanceof Error ? error.message : "unknown error" }));
      return NextResponse.json({ error: "Email delivery is unavailable. Try again later or contact support." }, { status: 503 });
    }
  }
  return NextResponse.json({ ok: true });
}
