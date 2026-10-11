import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabaseUrl } from "@/lib/environment";
import { getActiveRobots } from "@/lib/robots";
import { robotImageUrl } from "@/lib/robots";

const querySchema = z.object({
  q: z.string().trim().max(80).optional(),
  risk: z.string().trim().max(40).optional(),
  type: z.string().trim().max(80).optional(),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view robot listings." }, { status: 401 });
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid search filters." }, { status: 400 });
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "Robot listings are unavailable until the database is configured." }, { status: 503 });
  }

  try {
    const robots = await getActiveRobots({ query: parsed.data.q, risk: parsed.data.risk, type: parsed.data.type });
    return NextResponse.json(robots.map((robot) => ({
      id: robot.id,
      name: robot.name,
      slug: robot.slug,
      description: robot.description,
      strategyDescription: robot.strategyDescription,
      market: robot.market,
      riskLevel: robot.riskLevel,
      robotType: robot.robotType,
      tier: robot.tier,
      imageUrl: robotImageUrl(robot),
      performanceKind: robot.performanceKind,
      performanceSummary: robot.performanceSummary,
      plans: robot.plans.map((plan) => ({ ...plan, price: plan.price.toFixed(2) })),
    })));
  } catch (error) {
    console.error(JSON.stringify({ event: "robot_marketplace_query_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Robot listings are temporarily unavailable." }, { status: 503 });
  }
}
