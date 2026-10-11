import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import UserManagementPanel from "@/components/user-management-panel";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fadmin%2Fusers");
  if (user.role !== "ADMIN") redirect("/account");
  return <AccountFrame user={user} activeHref="/admin/users"><header className="account-header"><div><span className="label">ADMINISTRATION</span><h1>User management</h1><p>Search accounts, update contact information, and manage account access.</p></div></header><UserManagementPanel currentUserId={user.id} /></AccountFrame>;
}
