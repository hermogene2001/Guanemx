import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabaseUrl } from "@/lib/environment";
import { getActiveRobots } from "@/lib/robots";
import { robotImageUrl } from "@/lib/robots";
import AccountNavigation from "@/components/account-navigation";
import RobotMarketplace from "@/components/robot-marketplace";

export const dynamic = "force-dynamic";
type ActiveRobot = Awaited<ReturnType<typeof getActiveRobots>>[number];

export default async function RobotsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Frobots");

  let robots: ActiveRobot[] = [];
  let unavailable: "database-config" | "database-error" | null = null;
  if (!hasDatabaseUrl()) {
    unavailable = "database-config";
  } else {
    try {
      robots = await getActiveRobots();
    } catch (error) {
      console.error(JSON.stringify({ event: "robot_marketplace_page_failed", message: error instanceof Error ? error.message : "unknown error" }));
      unavailable = "database-error";
    }
  }

  return <main className="account-shell">
    <AccountNavigation user={user} activeHref="/robots" />
    <section className="account-main"><div className="marketplace marketplace-v2">
      <header className="market-head"><span className="brand">Robot Marketplace</span><span className="marketplace-count">{robots.length} listings</span></header>
      <section className="market-intro"><span className="label">GUANEMX CATALOG</span><h1>Find a strategy that fits</h1><p>Compare robot plans, strategy descriptions, durations, and risk information.</p></section>
      {unavailable ? <section className="market-empty"><h2>{unavailable === "database-config" ? "Database connection is not configured" : "Listings are temporarily unavailable"}</h2><p>{unavailable === "database-config" ? "Set DATABASE_URL in your local .env file using .env.example, then restart the development server." : "Please try again later."}</p></section> : <RobotMarketplace robots={robots.map((robot) => ({
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
        plans: robot.plans.map((plan) => ({ id: plan.id, name: plan.name, durationDays: plan.durationDays, price: plan.price.toFixed(2), dailyReturnPercentage: plan.dailyReturnPercentage.toFixed(2), currency: plan.currency })),
      }))} />}
      <p className="risk-note">Past performance does not guarantee future results. Trading involves risk and losses are possible.</p>
    </div></section>
  </main>;
}
