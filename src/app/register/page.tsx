import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AuthForm from "@/components/auth-form";
import AuthTradingArt, { AuthTrustBar } from "@/components/auth-trading-art";
import BrandLogo from "@/components/brand-logo";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : user.role === "AGENT" ? "/agent" : "/account");
  return <main className="auth-page auth-portal register-portal">
    <header className="auth-top"><BrandLogo /><Link href="/">Back to GuanemX</Link></header>
    <div className="auth-layout">
      <section className="auth-card auth-panel"><span className="auth-step">CREATE YOUR ACCOUNT</span><span className="label">JOIN GUANEMX</span><h1>Create your account</h1><p>Register to explore available strategies and manage your account.</p><AuthForm mode="register" nextPath="/account" /><div className="auth-switch">Already registered? <Link href="/login">Sign in</Link></div></section>
      <AuthTradingArt />
    </div>
    <AuthTrustBar />
  </main>;
}
