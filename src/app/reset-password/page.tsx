import Link from "next/link";
import AuthFlowForm from "@/components/auth-flow-form";
import BrandLogo from "@/components/brand-logo";

export const metadata = { title: "Choose a new password · GuanemX" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <main className="auth-page auth-portal"><header className="auth-top"><BrandLogo /><Link href="/">Back to GuanemX</Link></header><section className="auth-card auth-panel"><span className="label">ACCOUNT SECURITY</span><h1>Choose a new password</h1><p>Use at least 12 characters. Other active sessions will be signed out.</p><AuthFlowForm mode="reset" token={token} /></section></main>;
}
