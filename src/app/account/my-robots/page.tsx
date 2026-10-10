import Link from "next/link";
import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MyRobotsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Faccount%2Fmy-robots");
  const subscriptions = await prisma.subscription.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { robot: { select: { name: true, market: true, riskLevel: true, slug: true } }, robotPlan: { select: { name: true, durationDays: true } } } });
  return <AccountFrame user={user} activeHref="/account/my-robots"><header className="account-header"><div><span className="label">SUBSCRIPTIONS</span><h1>My robots</h1><p>Review your robot subscription status and plan details.</p></div></header><section className="finance-card ledger-card">{subscriptions.length === 0 ? <div className="market-empty"><h2>No subscriptions yet</h2><p>Explore the robot marketplace to find available strategies and plans.</p><Link className="button" href="/robots">Explore robots</Link></div> : <div className="finance-list">{subscriptions.map((item) => <article className="finance-row" key={item.id}><div><strong>{item.robot.name} · {item.robotPlan.name}</strong><small>{item.robot.market} · {item.robot.riskLevel} risk · {item.robotPlan.durationDays} days</small><small>Started {item.startAt ? new Date(item.startAt).toLocaleString() : "Not started"} · Expires {item.expiresAt ? new Date(item.expiresAt).toLocaleString() : "Not scheduled"}</small>{item.status === "EXPIRED" && <Link href={`/robots/${item.robot.slug}`}>View renewal options</Link>}</div><div><span className={`finance-status ${item.status.toLowerCase()}`}>{item.status.toLowerCase()}</span><small>{item.currency} {item.price.toString()}</small></div></article>)}</div>}</section></AccountFrame>;
}
