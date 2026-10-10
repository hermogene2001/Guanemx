import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AccountNavigation, { accountServices } from "@/components/account-navigation";

export const dynamic = "force-dynamic";

const serviceDetails: Record<string, string> = {
  "/account/market": "View market prices and chart information.",
  "/robots": "Explore automated strategies and risk details.",
  "/account/my-robots": "Review your active and past subscriptions.",
  "/account/wallet": "View your available and pending balances.",
  "/account/recharge": "Add funds using an agent-confirmed manual recharge.",
  "/account/payout-setup": "Save a bank or mobile-money payout destination.",
  "/account/withdrawals": "Manage withdrawal requests and their status.",
  "/account/transactions": "Review your account transaction history.",
  "/account/community": "Connect with the GuanemX community.",
  "/account/profile": "Manage your personal account information.",
  "/account/security": "Manage your password and account security.",
};

const activeServices = new Set(["/account/recharge", "/account/payout-setup", "/account/wallet", "/account/withdrawals", "/account/transactions", "/account/my-robots", "/account/community", "/account/profile", "/account/security", "/robots"]);

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Faccount");

  return <main className="account-shell">
    <AccountNavigation user={user} activeHref="/account" />
    <section className="account-main">
      <header className="account-header"><div><span className="label">ACCOUNT OVERVIEW</span><h1>Welcome, {user.name.split(" ")[0]}</h1><p>Your GuanemX services and account activity in one place.</p></div><span className={user.status === "ACTIVE" ? "account-status" : "account-status pending"}><i />{user.status === "ACTIVE" ? "Account active" : "Verification pending"}</span></header>
      <section className="account-notice"><span>i</span><p>Wallet, robot subscriptions, manual recharge, payout setup, withdrawals, transactions, profile, security, and community are available. Robot plans debit Main Balance and do not promise trading returns. Live market data still requires a provider.</p></section>
      <div className="account-section-heading"><div><span className="label">SERVICES</span><h2>Explore your account</h2></div><span>{accountServices.length} services</span></div>
      <div className="service-grid">{accountServices.filter((service) => service.name !== "Dashboard").map((service) => <Link className="service-card" href={service.href} key={service.name}>
        <span className="service-icon">{service.icon}</span><span className={activeServices.has(service.href) ? "service-state ready" : "service-state"}>{activeServices.has(service.href) ? "Available" : "Coming soon"}</span><h3>{service.name}</h3><p>{serviceDetails[service.href]}</p><span className="service-arrow">{activeServices.has(service.href) ? "Explore →" : "Details →"}</span>
      </Link>)}</div>
      <p className="account-risk-note">Past performance does not guarantee future results. Trading involves risk and losses are possible.</p>
    </section>
  </main>;
}
