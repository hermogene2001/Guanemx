import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import AgentReviewPanel from "@/components/agent-review-panel";
import { getCurrentUser } from "@/lib/auth";
import { getPlatformSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AgentRequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fagent%2Frequests");
  if (user.role !== "AGENT" && user.role !== "ADMIN") redirect("/account");
  const settings = await getPlatformSettings();
  return <AccountFrame user={user} activeHref="/agent/requests"><header className="account-header"><div><span className="label">OPERATIONS</span><h1>Agent review</h1><p>Confirm off-platform recharge receipts and review payout requests.</p></div></header><AgentReviewPanel rate={settings.usdToRwfRate.toString()} /></AccountFrame>;
}
