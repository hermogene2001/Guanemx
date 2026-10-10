import Link from "next/link";
import SignOutButton from "@/components/sign-out-button";
import type { getCurrentUser } from "@/lib/auth";
import ThemeSelector from "@/components/theme-selector";
import BrandLogo from "@/components/brand-logo";

type AccountUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

type IconName = "dashboard" | "market" | "robot" | "layers" | "wallet" | "recharge" | "bank" | "withdraw" | "receipt" | "community" | "profile" | "security" | "operations" | "review" | "settings";

export const accountServices: { icon: IconName; name: string; href: string }[] = [
  { icon: "dashboard", name: "Dashboard", href: "/account" },
  { icon: "market", name: "Live market", href: "/account/market" },
  { icon: "robot", name: "Robot marketplace", href: "/robots" },
  { icon: "layers", name: "My robots", href: "/account/my-robots" },
  { icon: "wallet", name: "Wallet", href: "/account/wallet" },
  { icon: "recharge", name: "Recharge", href: "/account/recharge" },
  { icon: "bank", name: "Payout Setup", href: "/account/payout-setup" },
  { icon: "withdraw", name: "Withdrawals", href: "/account/withdrawals" },
  { icon: "receipt", name: "Transactions", href: "/account/transactions" },
  { icon: "community", name: "Community", href: "/account/community" },
  { icon: "profile", name: "Profile", href: "/account/profile" },
  { icon: "security", name: "Security", href: "/account/security" },
];

function NavIcon({ name }: { name: IconName }) {
  const common = { stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const paths: Record<IconName, React.ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    market: <><path d="M3 17 8 12l4 3 8-9" /><path d="M15 6h5v5" /></>,
    robot: <><rect x="4" y="7" width="16" height="14" rx="3" /><path d="M12 3v4M8 12h.01M16 12h.01M9 17h6" /><path d="M2 12h2m16 0h2" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18M16 14h2" /><path d="M6 5V3h12" /></>,
    recharge: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8m-4-4h8" /></>,
    bank: <><path d="m3 9 9-6 9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18M2 18h20" /></>,
    withdraw: <><path d="M7 17 17 7M8 7h9v9" /><path d="M4 4v16h16" /></>,
    receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6m-6 4h6m-6 4h4" /></>,
    community: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
    security: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    operations: <><path d="M9 4h6l2 2h4v15H3V6h4l2-2Z" /><path d="M8 11h8m-8 4h8" /></>,
    review: <><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /><path d="M12 3v2m9 7h-2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.6.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.6-.9l-1.7.6-1.4-2.4 1.4-1.1a8 8 0 0 1 0-1.9L6.1 12l1.4-2.4 1.7.6a8 8 0 0 1 1.6-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.6.9l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 1.9Z" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" {...common}>{paths[name]}</svg>;
}

export default function AccountNavigation({ user, activeHref }: { user: AccountUser; activeHref?: string }) {
  return <aside className="account-sidebar">
    <BrandLogo />
    <ThemeSelector />
    <p className="account-sidebar-label">YOUR ACCOUNT</p>
    <nav className="account-nav" aria-label="Account services">
      {accountServices.map((service) => <Link className={activeHref === service.href ? "account-nav-link selected" : "account-nav-link"} href={service.href} key={service.name}><span className="account-nav-icon"><NavIcon name={service.icon} /></span>{service.name}</Link>)}
      {(user.role === "AGENT" || user.role === "ADMIN") && <>
        <p className="account-sidebar-label staff-nav-label">OPERATIONS</p>
        <Link className={activeHref === "/agent" ? "account-nav-link selected" : "account-nav-link"} href="/agent"><span className="account-nav-icon"><NavIcon name="operations" /></span>Operations home</Link>
        <Link className={activeHref === "/agent/requests" ? "account-nav-link selected" : "account-nav-link"} href="/agent/requests"><span className="account-nav-icon"><NavIcon name="review" /></span>Review requests</Link>
      </>}
      {user.role === "ADMIN" && <>
        <p className="account-sidebar-label staff-nav-label">ADMINISTRATION</p>
        <Link className={activeHref === "/admin" ? "account-nav-link selected" : "account-nav-link"} href="/admin"><span className="account-nav-icon"><NavIcon name="dashboard" /></span>Admin overview</Link>
        <Link className={activeHref === "/admin/robots" ? "account-nav-link selected" : "account-nav-link"} href="/admin/robots"><span className="account-nav-icon"><NavIcon name="robot" /></span>Robot catalog</Link>
        <Link className={activeHref === "/admin/agents" ? "account-nav-link selected" : "account-nav-link"} href="/admin/agents"><span className="account-nav-icon"><NavIcon name="settings" /></span>Agent management</Link>
      </>}
    </nav>
    <div className="account-user"><span className="account-avatar">{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.email}</small></div></div>
    <SignOutButton />
  </aside>;
}
