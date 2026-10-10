import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import ProfilePanel from "@/components/profile-panel";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Faccount%2Fprofile");
  let profile = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, email: true, phone: true, referralCode: true } });
  if (!profile.referralCode) {
    const code = randomBytes(6).toString("hex").toUpperCase();
    await prisma.user.updateMany({ where: { id: user.id, referralCode: null }, data: { referralCode: code } });
    profile = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, email: true, phone: true, referralCode: true } });
  }
  return <AccountFrame user={user} activeHref="/account/profile"><header className="account-header"><div><span className="label">ACCOUNT SETTINGS</span><h1>Profile</h1><p>Manage your contact information and invitation code.</p></div></header><ProfilePanel name={profile.name} email={profile.email} phone={profile.phone ?? ""} referralCode={profile.referralCode ?? ""} /></AccountFrame>;
}
