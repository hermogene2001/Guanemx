import Link from "next/link";
import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fagent");
  if (user.role !== "AGENT" && user.role !== "ADMIN") redirect("/account");

  const assigned = user.role === "ADMIN" ? {} : { assignedAgentId: user.id };
  const [recharges, withdrawals, reviewed] = await Promise.all([
    prisma.rechargeRequest.count({ where: { ...assigned, status: "PENDING" } }),
    prisma.withdrawal.count({ where: { ...assigned, status: "PENDING" } }),
    prisma.auditLog.count({ where: { actorUserId: user.id, action: { in: ["recharge.confirmed", "recharge.rejected", "withdrawal.approved", "withdrawal.rejected"] } } }),
  ]);

  return <AccountFrame user={user} activeHref="/agent">
    <header className="account-header"><div><span className="label">OPERATIONS</span><h1>{user.role === "ADMIN" ? "Finance operations" : `Welcome, ${user.name.split(" ")[0]}`}</h1><p>{user.role === "ADMIN" ? "View every pending finance request across the team." : "Review the finance requests assigned to your agent account."}</p></div><Link className="button" href="/agent/requests">Open review queue</Link></header>
    <section className="staff-metric-grid agent-metrics" aria-label="Your work queue">
      <article className="staff-metric"><span>Pending recharges</span><strong>{recharges.toLocaleString()}</strong><small>{user.role === "ADMIN" ? "Across all agents" : "Assigned to you"}</small></article>
      <article className="staff-metric"><span>Pending withdrawals</span><strong>{withdrawals.toLocaleString()}</strong><small>{user.role === "ADMIN" ? "Across all agents" : "Assigned to you"}</small></article>
      <article className="staff-metric"><span>Reviews recorded</span><strong>{reviewed.toLocaleString()}</strong><small>Your completed decisions</small></article>
    </section>
    <section className="finance-card agent-workflow-card"><span className="label">REVIEW WORKFLOW</span><h2>Handle each request carefully</h2><div className="staff-workflow-list"><p><b>1</b><span><strong>Recharges</strong><small>Confirm only after verifying that the client’s off-platform payment was received.</small></span></p><p><b>2</b><span><strong>Withdrawals</strong><small>Check the payout details, fee, and net amount. Approval records the payout for manual processing.</small></span></p><p><b>3</b><span><strong>Audit trail</strong><small>Every decision records the reviewer and updates wallet transactions atomically.</small></span></p></div><Link className="button" href="/agent/requests">Review pending requests <span>→</span></Link></section>
  </AccountFrame>;
}
