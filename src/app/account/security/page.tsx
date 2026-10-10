import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import PasswordPanel from "@/components/password-panel";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Faccount%2Fsecurity");
  return <AccountFrame user={user} activeHref="/account/security"><header className="account-header"><div><span className="label">ACCOUNT SETTINGS</span><h1>Security</h1><p>Protect your GuanemX account.</p></div></header><PasswordPanel /></AccountFrame>;
}
