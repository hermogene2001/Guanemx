import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import WithdrawalPanel from "@/components/withdrawal-panel";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlatformSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function WithdrawalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Faccount%2Fwithdrawals");
  const [wallet, settings] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: user.id }, select: { availableBalance: true, growthBalance: true } }),
    getPlatformSettings(),
  ]);
  return <AccountFrame user={user} activeHref="/account/withdrawals"><header className="account-header"><div><span className="label">WALLET</span><h1>Withdrawals</h1><p>Request one withdrawal per day from Main or Growth Balance.</p></div></header><WithdrawalPanel mainBalance={wallet?.availableBalance.toString() ?? "0"} growthBalance={wallet?.growthBalance.toString() ?? "0"} rate={settings.usdToRwfRate.toString()} feePercent={settings.withdrawalFeePercent.toString()} minimumAmount={settings.minimumWithdrawalAmount.toFixed(0)} /></AccountFrame>;
}
