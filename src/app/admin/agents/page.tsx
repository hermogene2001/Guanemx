import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import AgentManagementPanel from "@/components/agent-management-panel";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminAgentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fadmin%2Fagents");
  if (user.role !== "ADMIN") redirect("/account");
  return <AccountFrame user={user} activeHref="/admin/agents"><header className="account-header"><div><span className="label">ADMINISTRATION</span><h1>Agent management</h1><p>Manage the accounts that review recharge and withdrawal requests.</p></div></header><AgentManagementPanel /></AccountFrame>;
}
