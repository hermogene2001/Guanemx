import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import RobotManagementPanel from "@/components/robot-management-panel";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminRobotsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fadmin%2Frobots");
  if (user.role !== "ADMIN") redirect("/account");
  return <AccountFrame user={user} activeHref="/admin/robots"><header className="account-header"><div><span className="label">ADMINISTRATION</span><h1>Robot catalog</h1><p>Create robots, configure subscription plans, and control which listings appear in the marketplace.</p></div></header><RobotManagementPanel /></AccountFrame>;
}
