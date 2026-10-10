import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import RechargePanel from "@/components/recharge-panel";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RechargePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Faccount%2Frecharge");
  return <AccountFrame user={user} activeHref="/account/recharge"><header className="account-header"><div><span className="label">MAIN BALANCE</span><h1>Recharge</h1><p>Request a manual mobile-money recharge in Rwandan francs.</p></div></header><RechargePanel /></AccountFrame>;
}
