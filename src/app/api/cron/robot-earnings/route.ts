import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runRobotEarnings } from "@/lib/robot-earnings";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function runRobotEarningsJob(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: "Unauthorized scheduled job request." }, { status: 401 });
  try {
    const result = await runRobotEarnings();
    if (result.failedCount > 0) return NextResponse.json(result, { status: 500 });
    return NextResponse.json(result);
  } catch (error) {
    logger.error("robot_earnings_endpoint_failed", { message: error instanceof Error ? error.message : "unknown error" });
    return NextResponse.json({ error: "Robot earnings could not be processed." }, { status: 500 });
  }
}

// Vercel Cron invokes scheduled endpoints with GET; POST remains for manual/scheduler calls.
export const GET = runRobotEarningsJob;
export const POST = runRobotEarningsJob;
