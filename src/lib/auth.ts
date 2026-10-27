import { createHash, createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { Prisma, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasDatabaseUrl } from "@/lib/environment";
import { SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "@/lib/constants";

export const SESSION_COOKIE = SESSION_COOKIE_NAME;

export function authConfigurationReady() {
  return Boolean(hasDatabaseUrl() && process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32);
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(tx: Prisma.TransactionClient, userId: string, request: Request) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const ipAddress = request.headers.get("x-real-ip")?.slice(0, 64) ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64) ?? null;
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;
  const session = await tx.userSession.create({ data: {
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
    ipAddress,
    userAgent,
  } });
  return { token, session };
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
}

export async function getCurrentUser() {
  if (!hasDatabaseUrl()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true, status: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== UserStatus.ACTIVE) return null;
  return { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role, status: session.user.status };
}

export async function consumeRateLimit(request: Request, scope: string, subject: string, limit: number, windowMs: number) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return false;
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const id = createHmac("sha256", secret).update(`${scope}|${ip}|${subject}`).digest("hex");
  const now = new Date();

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const bucket = await tx.rateLimitBucket.findUnique({ where: { id } });
        if (!bucket) {
          await tx.rateLimitBucket.create({ data: { id, hits: 1, windowStartedAt: now } });
          return true;
        }
        if (bucket.blockedUntil && bucket.blockedUntil > now) return false;
        if (now.getTime() - bucket.windowStartedAt.getTime() >= windowMs) {
          await tx.rateLimitBucket.update({ where: { id }, data: { hits: 1, windowStartedAt: now, blockedUntil: null } });
          return true;
        }
        if (bucket.hits >= limit) {
          await tx.rateLimitBucket.update({ where: { id }, data: { blockedUntil: new Date(bucket.windowStartedAt.getTime() + windowMs) } });
          return false;
        }
        await tx.rateLimitBucket.update({ where: { id }, data: { hits: { increment: 1 } } });
        return true;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) continue;
      throw error;
    }
  }
  return false;
}

export function sameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
