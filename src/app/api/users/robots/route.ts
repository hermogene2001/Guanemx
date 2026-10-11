import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your robots." }, { status: 401 });

  try {
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        robot: { select: { name: true, slug: true, market: true, riskLevel: true, status: true } },
        robotPlan: { select: { name: true, durationDays: true } },
      },
    });
    const subscriptionIds = subscriptions.map((item) => item.id);
    const earnings = subscriptionIds.length ? await prisma.transaction.groupBy({
      by: ["subscriptionId"],
      where: { userId: user.id, subscriptionId: { in: subscriptionIds }, type: "ROBOT_EARNING", status: "COMPLETED" },
      _sum: { amount: true },
    }) : [];
    const earnedBySubscription = new Map(earnings.map((item) => [item.subscriptionId, item._sum.amount?.toFixed(2) ?? "0.00"]));

    return NextResponse.json({
      robots: subscriptions.map((item) => ({
        subscriptionId: item.id,
        robotId: item.robotId,
        robot: item.robot.name,
        slug: item.robot.slug,
        market: item.robot.market,
        riskLevel: item.robot.riskLevel,
        plan: item.robotPlan.name,
        investmentAmount: item.price.toFixed(2),
        currency: item.currency,
        dailyReturnPercentage: item.dailyReturnPercentage.toFixed(2),
        status: item.status === "ACTIVE" && item.robot.status !== "ACTIVE" ? "PAUSED" : item.status,
        daysCompleted: item.daysCompleted,
        daysRemaining: Math.max(0, item.robotPlan.durationDays - item.daysCompleted),
        durationDays: item.robotPlan.durationDays,
        totalEarned: earnedBySubscription.get(item.id) ?? "0.00",
        lastCreditedAt: item.lastCreditedAt?.toISOString() ?? null,
        startedAt: item.startAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "user_robot_list_failed", userId: user.id, message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Your robot subscriptions are temporarily unavailable." }, { status: 500 });
  }
}
