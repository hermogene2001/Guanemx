import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import AgentHistoryPanel from "@/components/agent-history-panel";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AgentHistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fagent%2Fhistory");
  if (user.role !== "AGENT" && user.role !== "ADMIN") redirect("/account");

  return (
    <AccountFrame user={user} activeHref="/agent/history">
      <header className="account-header">
        <div>
          <span className="label">OPERATIONS</span>
          <h1>Review history</h1>
          <p>All recharge and withdrawal decisions you have recorded.</p>
        </div>
      </header>
      <AgentHistoryPanel />
    </AccountFrame>
  );
}
