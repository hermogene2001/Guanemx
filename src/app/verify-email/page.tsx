import Link from "next/link";
import AuthFlowForm from "@/components/auth-flow-form";
import BrandLogo from "@/components/brand-logo";

export const metadata = { title: "Verify email · GuanemX" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; sent?: string }> }) {
  const params = await searchParams;
  return <main className="auth-page auth-portal"><header className="auth-top"><BrandLogo /><Link href="/">Back to GuanemX</Link></header><section className="auth-card auth-panel"><span className="label">ACCOUNT VERIFICATION</span><h1>Verify your email</h1><p>Confirm your email address to activate your GuanemX account.</p><AuthFlowForm mode="verify" token={params.token} sent={params.sent === "1"} /></section></main>;
}
