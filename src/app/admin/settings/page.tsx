import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import PlatformSettingsPanel from "@/components/platform-settings-panel";
import CryptoWalletSettingsPanel from "@/components/crypto-wallet-settings-panel";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fadmin%2Fsettings");
  if (user.role !== "ADMIN") redirect("/account");
  return <AccountFrame user={user} activeHref="/admin/settings"><header className="account-header"><div><span className="label">ADMINISTRATION</span><h1>Platform settings</h1><p>Configure currency rates, fees, and payment destinations.</p></div></header><div className="admin-settings-stack"><PlatformSettingsPanel /><CryptoWalletSettingsPanel /></div></AccountFrame>;
}
