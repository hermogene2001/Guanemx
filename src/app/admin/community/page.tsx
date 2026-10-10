import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import CommunityModerationPanel from "@/components/community-moderation-panel";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminCommunityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fadmin%2Fcommunity");
  if (user.role !== "ADMIN") redirect("/account");
  return <AccountFrame user={user} activeHref="/admin"><header className="account-header"><div><span className="label">ADMINISTRATION</span><h1>Community moderation</h1><p>Review reported messages, remove harmful content, or restore messages.</p></div></header><CommunityModerationPanel /></AccountFrame>;
}
