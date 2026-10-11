import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import RechargePanel from "@/components/recharge-panel";
import { getCurrentUser } from "@/lib/auth";
import { getPlatformSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function RechargePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Faccount%2Frecharge");
  const settings = await getPlatformSettings();
  return <AccountFrame user={user} activeHref="/account/recharge"><header className="account-header"><div><span className="label">MAIN BALANCE</span><h1>Recharge</h1><p>Request a manual recharge. Amounts are in US dollars; the Rwandan-franc equivalent is shown at the current rate.</p></div></header><RechargePanel rate={settings.usdToRwfRate.toString()} /></AccountFrame>;
}
