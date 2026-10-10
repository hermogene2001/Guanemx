import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import PayoutSetupPanel from "@/components/payout-setup-panel";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PayoutSetupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Faccount%2Fpayout-setup");
  return <AccountFrame user={user} activeHref="/account/payout-setup"><header className="account-header"><div><span className="label">WITHDRAWAL SETUP</span><h1>Payout Setup</h1><p>Add a bank or mobile-money destination before requesting a withdrawal.</p></div></header><PayoutSetupPanel /></AccountFrame>;
}
