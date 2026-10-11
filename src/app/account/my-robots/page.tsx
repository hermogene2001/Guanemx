import Link from "next/link";
import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateCycleEarning } from "@/lib/robot-earnings";

export const dynamic = "force-dynamic";

export default async function MyRobotsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Faccount%2Fmy-robots");
  const subscriptions = await prisma.subscription.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { robot: { select: { name: true, market: true, riskLevel: true, slug: true, status: true } }, robotPlan: { select: { name: true, durationDays: true } } } });
  const earnings = subscriptions.length ? await prisma.transaction.groupBy({
    by: ["subscriptionId"],
    where: { userId: user.id, subscriptionId: { in: subscriptions.map((item) => item.id) }, type: "ROBOT_EARNING", status: "COMPLETED" },
    _sum: { amount: true },
  }) : [];
  const earnedBySubscription = new Map(earnings.map((item) => [item.subscriptionId, item._sum.amount?.toFixed(2) ?? "0.00"]));
  return <AccountFrame user={user} activeHref="/account/my-robots"><header className="account-header"><div><span className="label">SUBSCRIPTIONS</span><h1>My robots</h1><p>Track configured daily returns, completed days, and wallet credits.</p></div></header><section className="finance-card ledger-card">{subscriptions.length === 0 ? <div className="market-empty"><h2>No subscriptions yet</h2><p>Explore the robot marketplace to find available strategies and plans.</p><Link className="button" href="/robots">Explore robots</Link></div> : <div className="finance-list">{subscriptions.map((item) => { const status = item.status === "ACTIVE" && item.robot.status !== "ACTIVE" ? "PAUSED" : item.status; const projectedCycleEarnings = calculateCycleEarning(item.price, item.dailyReturnPercentage, item.robotPlan.durationDays); return <article className="finance-row" key={item.id}><div><strong>{item.robot.name} · {item.robotPlan.name}</strong><small>{item.robot.market} · {item.robot.riskLevel} risk · {item.robotPlan.durationDays} days · {item.dailyReturnPercentage.toFixed(2)}% configured daily return</small><small>{item.daysCompleted} days completed · {Math.max(0, item.robotPlan.durationDays - item.daysCompleted)} days remaining</small><small>Credited to date: {item.currency} {earnedBySubscription.get(item.id) ?? "0.00"} · Projected total earnings after full cycle: {item.currency} {projectedCycleEarnings.toFixed(2)}</small><small>Started {item.startAt ? new Date(item.startAt).toLocaleString() : "Not started"} · Expires {item.expiresAt ? new Date(item.expiresAt).toLocaleString() : "Not scheduled"}</small>{item.status === "EXPIRED" && <Link href={`/robots/${item.robot.slug}`}>View renewal options</Link>}</div><div><span className={`finance-status ${status.toLowerCase()}`}>{status.toLowerCase()}</span><small>Investment: {item.currency} {item.price.toString()}</small></div></article>; })}</div>}<p className="risk-note">Projected earnings assume every daily credit is made for the full cycle. They are not guaranteed; paused robots do not accrue credits, and due days can only be caught up while the subscription remains active.</p></section></AccountFrame>;
}
