import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runRobotEarnings } from "@/lib/robot-earnings";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: "Unauthorized scheduled job request." }, { status: 401 });
  const now = new Date();
  try {
    const earnings = await runRobotEarnings(now);
    if (earnings.failedCount > 0) {
      return NextResponse.json({ error: "Daily robot earnings failed; due subscriptions were not expired.", earnings }, { status: 500 });
    }
    const [subscriptions, tokens, sessions] = await prisma.$transaction([
      prisma.subscription.updateMany({
        where: { status: "ACTIVE", expiresAt: { lte: now } },
        data: { status: "EXPIRED" },
      }),
      prisma.verificationToken.deleteMany({ where: { expiresAt: { lte: now } } }),
      prisma.userSession.deleteMany({ where: { expiresAt: { lte: now } } }),
    ]);
    return NextResponse.json({
      completedAt: now.toISOString(),
      creditedRobotDays: earnings.processedCount,
      expiredSubscriptions: subscriptions.count,
      removedExpiredVerificationTokens: tokens.count,
      removedExpiredSessions: sessions.count,
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "subscription_expiry_job_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Scheduled subscription maintenance failed." }, { status: 500 });
  }
}
