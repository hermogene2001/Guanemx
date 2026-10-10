import AccountNavigation from "@/components/account-navigation";
import type { getCurrentUser } from "@/lib/auth";

type AccountUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export default function AccountFrame({ user, activeHref, children }: { user: AccountUser; activeHref: string; children: React.ReactNode }) {
  return (
    <main className="account-shell">
      <AccountNavigation user={user} activeHref={activeHref} />
      <section className="account-main">{children}</section>
    </main>
  );
}
