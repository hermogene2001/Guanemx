import Link from "next/link";
import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import { getCurrentUser } from "@/lib/auth";
import { kigaliDayStart } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fagent");
  if (user.role !== "AGENT" && user.role !== "ADMIN") redirect("/account");

  const assigned = user.role === "ADMIN" ? {} : { assignedAgentId: user.id };
  const todayStart = kigaliDayStart();

  const [
    pendingRecharges,
    pendingWithdrawals,
    todayReviewed,
    totalRechargesConfirmed,
    totalRechargesRejected,
    totalWithdrawalsApproved,
    totalWithdrawalsRejected,
  ] = await Promise.all([
    prisma.rechargeRequest.count({ where: { ...assigned, status: "PENDING" } }),
    prisma.withdrawal.count({ where: { ...assigned, status: "PENDING" } }),
    prisma.auditLog.count({
      where: {
        actorUserId: user.id,
        action: { in: ["recharge.confirmed", "recharge.rejected", "withdrawal.approved", "withdrawal.rejected"] },
        createdAt: { gte: todayStart },
      },
    }),
    prisma.rechargeRequest.count({ where: { reviewedById: user.id, status: "CONFIRMED" } }),
    prisma.rechargeRequest.count({ where: { reviewedById: user.id, status: "REJECTED" } }),
    prisma.withdrawal.count({ where: { reviewedById: user.id, status: "APPROVED" } }),
    prisma.withdrawal.count({ where: { reviewedById: user.id, status: "REJECTED" } }),
  ]);

  const totalReviewed = totalRechargesConfirmed + totalRechargesRejected + totalWithdrawalsApproved + totalWithdrawalsRejected;
  const isAdmin = user.role === "ADMIN";

  return (
    <AccountFrame user={user} activeHref="/agent">
      <header className="account-header">
        <div>
          <span className="label">OPERATIONS</span>
          <h1>{isAdmin ? "Finance operations" : `Welcome, ${user.name.split(" ")[0]}`}</h1>
          <p>
            {isAdmin
              ? "View every pending finance request across the team."
              : "Review the finance requests assigned to your agent account."}
          </p>
        </div>
        <Link className="button" href="/agent/requests">Open review queue</Link>
      </header>

      {/* Live queue counters */}
      <section className="staff-metric-grid agent-metrics" aria-label="Your work queue">
        <article className="staff-metric">
          <span>Pending recharges</span>
          <strong>{pendingRecharges.toLocaleString()}</strong>
          <small>{isAdmin ? "Across all agents" : "Assigned to you"}</small>
          {pendingRecharges > 0 && (
            <Link href="/agent/requests" className="staff-metric-link">Review now →</Link>
          )}
        </article>
        <article className="staff-metric">
          <span>Pending withdrawals</span>
          <strong>{pendingWithdrawals.toLocaleString()}</strong>
          <small>{isAdmin ? "Across all agents" : "Assigned to you"}</small>
          {pendingWithdrawals > 0 && (
            <Link href="/agent/requests" className="staff-metric-link">Review now →</Link>
          )}
        </article>
        <article className="staff-metric">
          <span>Reviewed today</span>
          <strong>{todayReviewed.toLocaleString()}</strong>
          <small>Your decisions since midnight (Kigali)</small>
        </article>
      </section>

      {/* All-time stats */}
      <section className="staff-metric-grid" aria-label="All-time stats" style={{ marginTop: "0" }}>
        <article className="staff-metric">
          <span>Recharges confirmed</span>
          <strong>{totalRechargesConfirmed.toLocaleString()}</strong>
          <small>All time</small>
        </article>
        <article className="staff-metric">
          <span>Recharges rejected</span>
          <strong>{totalRechargesRejected.toLocaleString()}</strong>
          <small>All time</small>
        </article>
        <article className="staff-metric">
          <span>Withdrawals approved</span>
          <strong>{totalWithdrawalsApproved.toLocaleString()}</strong>
          <small>All time</small>
        </article>
        <article className="staff-metric">
          <span>Withdrawals rejected</span>
          <strong>{totalWithdrawalsRejected.toLocaleString()}</strong>
          <small>All time</small>
        </article>
      </section>

      {/* Quick links */}
      <section className="staff-dashboard-grid" style={{ marginTop: "16px" }}>
        <div className="finance-card">
          <span className="label">QUICK ACTIONS</span>
          <h2>Jump to</h2>
          <div className="staff-shortcuts">
            <Link className="button" href="/agent/requests">
              Review pending requests <span>→</span>
            </Link>
            <Link className="button button-quiet" href="/agent/history">
              View review history <span>→</span>
            </Link>
          </div>
        </div>

        <div className="finance-card agent-workflow-card">
          <span className="label">REVIEW WORKFLOW</span>
          <h2>Handle each request carefully</h2>
          <div className="staff-workflow-list">
            <p>
              <b>1</b>
              <span>
                <strong>Recharges</strong>
                <small>Confirm only after verifying that the client&apos;s off-platform payment was received.</small>
              </span>
            </p>
            <p>
              <b>2</b>
              <span>
                <strong>Withdrawals</strong>
                <small>Check the payout details, fee, and net amount. Approval records the payout for manual processing.</small>
              </span>
            </p>
            <p>
              <b>3</b>
              <span>
                <strong>Audit trail</strong>
                <small>Every decision records the reviewer and updates wallet transactions atomically.</small>
              </span>
            </p>
          </div>
          <div style={{ display: "flex", gap: "9px", flexWrap: "wrap" }}>
            <Link className="button" href="/agent/requests">
              Review pending requests <span>→</span>
            </Link>
            {totalReviewed > 0 && (
              <Link className="button button-quiet" href="/agent/history">
                History ({totalReviewed.toLocaleString()}) <span>→</span>
              </Link>
            )}
          </div>
        </div>
      </section>
    </AccountFrame>
  );
}
