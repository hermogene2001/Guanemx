import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runRobotEarnings } from "@/lib/robot-earnings";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: "Unauthorized scheduled job request." }, { status: 401 });
  try {
    const result = await runRobotEarnings();
    if (result.failedCount > 0) return NextResponse.json(result, { status: 500 });
    return NextResponse.json(result);
  } catch (error) {
    console.error(JSON.stringify({ event: "robot_earnings_endpoint_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Robot earnings could not be processed." }, { status: 500 });
  }
}
