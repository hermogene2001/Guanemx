import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import CommunityPanel from "@/components/community-panel";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Faccount%2Fcommunity");
  return <AccountFrame user={user} activeHref="/account/community"><header className="account-header"><div><span className="label">COMMUNITY</span><h1>Community</h1><p>Join the GuanemX General room.</p></div></header><CommunityPanel /></AccountFrame>;
}
