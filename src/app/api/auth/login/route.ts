import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserStatus } from "@prisma/client";
import { compare } from "bcryptjs";
import { z } from "zod";
import { authConfigurationReady, consumeRateLimit, createSession, sameOriginRequest, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72) });

export async function POST(request: NextRequest) {
  try {
    if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  } catch {}
  if (!authConfigurationReady()) return NextResponse.json({ error: "Configure a real PostgreSQL DATABASE_URL and a 32-character AUTH_SECRET in .env." }, { status: 503 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  const email = parsed.data.email.toLowerCase();

  try {
    const ipAllowed = await consumeRateLimit(request, "login-ip", "all", 30, 15 * 60 * 1000);
    const accountAllowed = await consumeRateLimit(request, "login-account", email, 10, 15 * 60 * 1000);
    if (!ipAllowed || !accountAllowed) return NextResponse.json({ error: "Too many sign-in attempts. Try again later." }, { status: 429 });

    const user = await prisma.user.findUnique({ where: { email } });
    const passwordValid = user ? await compare(parsed.data.password, user.passwordHash) : false;
    if (!user || !passwordValid || user.status === UserStatus.SUSPENDED) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    if (user.status !== UserStatus.ACTIVE) {
      return NextResponse.json({ error: "Verify your email before signing in. Check your inbox for the verification link." }, { status: 403 });
    }

    const session = await prisma.$transaction((tx) => createSession(tx, user.id, request), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await setSessionCookie(session.token);
    const next = user.role === "ADMIN" ? "/admin" : user.role === "AGENT" ? "/agent" : "/account";
    return NextResponse.json({ user: { name: user.name, email: user.email, role: user.role }, next });
  } catch (error) {
    console.error(JSON.stringify({ event: "account_login_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Sign-in is temporarily unavailable." }, { status: 500 });
  }
}
