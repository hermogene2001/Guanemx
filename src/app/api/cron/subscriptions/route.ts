import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || secret.length < 32 || !supplied) return false;
  const expectedHash = createHash("sha256").update(secret).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedHash, suppliedHash);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized scheduled job request." }, { status: 401 });
  const now = new Date();
  try {
    const [subscriptions, tokens] = await prisma.$transaction([
      prisma.subscription.updateMany({
        where: { status: "ACTIVE", expiresAt: { lte: now } },
        data: { status: "EXPIRED" },
      }),
      prisma.verificationToken.deleteMany({ where: { expiresAt: { lte: now } } }),
    ]);
    return NextResponse.json({
      completedAt: now.toISOString(),
      expiredSubscriptions: subscriptions.count,
      removedExpiredVerificationTokens: tokens.count,
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "subscription_expiry_job_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Scheduled subscription maintenance failed." }, { status: 500 });
  }
}
