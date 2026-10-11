import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActiveRobot, robotImageUrl } from "@/lib/robots";
import AccountFrame from "@/components/account-frame";
import RobotProductView from "@/components/robot-product-view";

export const dynamic = "force-dynamic";

export default async function RobotDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/robots/${slug}`)}`);

  let robot;
  try {
    robot = await getActiveRobot(slug);
  } catch (error) {
    console.error(JSON.stringify({ event: "robot_details_query_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return <AccountFrame user={user} activeHref="/robots"><div className="market-error"><h1>Robot details are temporarily unavailable</h1><p>Please try again later.</p></div></AccountFrame>;
  }
  if (!robot || robot.plans.length === 0) notFound();

  return <AccountFrame user={user} activeHref="/robots"><RobotProductView robot={{
    name: robot.name,
    slug: robot.slug,
    description: robot.description,
    strategyDescription: robot.strategyDescription,
    market: robot.market,
    riskLevel: robot.riskLevel,
    robotType: robot.robotType,
    tier: robot.tier ?? "BEGINNER",
    imageUrl: robotImageUrl(robot),
    performanceKind: robot.performanceKind,
    performanceSummary: robot.performanceSummary,
    subscriberCount: robot._count.subscriptions,
    plans: robot.plans.map((plan) => ({ id: plan.id, name: plan.name, description: plan.description, durationDays: plan.durationDays, price: plan.price.toFixed(2), dailyReturnPercentage: plan.dailyReturnPercentage.toFixed(2), currency: plan.currency })),
  }} /></AccountFrame>;
}
