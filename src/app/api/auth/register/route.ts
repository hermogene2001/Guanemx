import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { Prisma, UserStatus } from "@prisma/client";
import { hash } from "bcryptjs";
import { z } from "zod";
import { authConfigurationReady, consumeRateLimit, sameOriginRequest } from "@/lib/auth";
import { sendMail, verificationLink } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { createVerificationToken, VERIFY_EMAIL_TTL_MS } from "@/lib/verification-tokens";

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72),
  invitationCode: z.string().trim().max(40).optional(),
});

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  if (!authConfigurationReady()) return NextResponse.json({ error: "Configure a real PostgreSQL DATABASE_URL and a 32-character AUTH_SECRET in .env." }, { status: 503 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a name, valid email, and password with at least 12 characters." }, { status: 400 });

  const name = parsed.data.name;
  const email = parsed.data.email.toLowerCase();
  const invitationCode = parsed.data.invitationCode?.toUpperCase() || null;
  try {
    const ipAllowed = await consumeRateLimit(request, "register-ip", "all", 5, 60 * 60 * 1000);
    const emailAllowed = await consumeRateLimit(request, "register-email", email, 3, 60 * 60 * 1000);
    if (!ipAllowed || !emailAllowed) return NextResponse.json({ error: "Too many account creation attempts. Try again later." }, { status: 429 });

    const passwordHash = await hash(parsed.data.password, 12);
    const result = await prisma.$transaction(async (tx) => {
      const inviter = invitationCode ? await tx.user.findUnique({ where: { referralCode: invitationCode }, select: { id: true } }) : null;
      if (invitationCode && !inviter) throw new Error("INVALID_INVITATION_CODE");
      const user = await tx.user.create({ data: {
        name, email, passwordHash, status: UserStatus.PENDING_VERIFICATION,
        referralCode: randomBytes(6).toString("hex").toUpperCase(), invitedById: inviter?.id,
      } });
      await tx.wallet.create({ data: { userId: user.id, currency: "RWF" } });
      const verificationToken = await createVerificationToken(tx, user.id, "verify-email", VERIFY_EMAIL_TTL_MS);
      return verificationToken;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await sendMail({
      to: email,
      subject: "Verify your GuanemX email",
      text: `Welcome to GuanemX! Verify your email to activate your account:\n\n${verificationLink("verify-email", result)}\n\nThis link is valid for 24 hours.`,
    });
    return NextResponse.json({ user: { name, email }, next: "/verify-email?sent=1" }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_INVITATION_CODE") return NextResponse.json({ error: "That invitation code is not valid." }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An account with this email already exists. Try signing in." }, { status: 409 });
    }
    console.error(JSON.stringify({ event: "account_registration_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Account creation is temporarily unavailable." }, { status: 500 });
  }
}
