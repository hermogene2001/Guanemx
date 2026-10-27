import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runRobotEarnings } from "@/lib/robot-earnings";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function runScheduledMaintenance(request: NextRequest) {
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
    logger.info("subscription_maintenance_completed", {
      creditedRobotDays: earnings.processedCount,
      expiredSubscriptions: subscriptions.count,
      removedExpiredVerificationTokens: tokens.count,
      removedExpiredSessions: sessions.count,
    });
    return NextResponse.json({
      completedAt: now.toISOString(),
      creditedRobotDays: earnings.processedCount,
      expiredSubscriptions: subscriptions.count,
      removedExpiredVerificationTokens: tokens.count,
      removedExpiredSessions: sessions.count,
    });
  } catch (error) {
    logger.error("subscription_expiry_job_failed", { message: error instanceof Error ? error.message : "unknown error" });
    return NextResponse.json({ error: "Scheduled subscription maintenance failed." }, { status: 500 });
  }
}

// Vercel Cron invokes scheduled endpoints with GET; POST remains for manual/scheduler calls.
export const GET = runScheduledMaintenance;
export const POST = runScheduledMaintenance;
