import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AuthForm from "@/components/auth-form";
import AuthTradingArt, { AuthTrustBar } from "@/components/auth-trading-art";
import BrandLogo from "@/components/brand-logo";

type Props = { searchParams: Promise<{ next?: string }> };

function safeNextPath(path?: string) {
  return path?.startsWith("/") && !path.startsWith("//") && !path.startsWith("/api/") ? path : "/account";
}

export default async function LoginPage({ searchParams }: Props) {
  const currentUser = await getCurrentUser();
  if (currentUser) redirect(currentUser.role === "ADMIN" ? "/admin" : currentUser.role === "AGENT" ? "/agent" : "/account");
  const { next } = await searchParams;
  return <main className="auth-page auth-portal">
    <header className="auth-top"><BrandLogo /><Link href="/">Back to GuanemX</Link></header>
    <div className="auth-layout">
      <section className="auth-card auth-panel"><span className="auth-step">ACCOUNT ACCESS</span><span className="label">WELCOME BACK</span><h1>Welcome back</h1><p>Sign in to continue to your GuanemX account and services.</p><AuthForm mode="login" nextPath={safeNextPath(next)} /><div className="auth-switch">Don’t have an account? <Link href="/register">Register</Link></div></section>
      <AuthTradingArt />
    </div>
    <AuthTrustBar />
  </main>;
}
