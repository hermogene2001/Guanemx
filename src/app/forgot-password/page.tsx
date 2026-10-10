import Link from "next/link";
import AuthFlowForm from "@/components/auth-flow-form";
import BrandLogo from "@/components/brand-logo";

export const metadata = { title: "Reset password · GuanemX" };

export default function ForgotPasswordPage() {
  return <main className="auth-page auth-portal"><header className="auth-top"><BrandLogo /><Link href="/">Back to GuanemX</Link></header><section className="auth-card auth-panel"><span className="label">ACCOUNT SECURITY</span><h1>Forgot password?</h1><p>Enter the email address on your account. If it matches, we will send a time-limited reset link.</p><AuthFlowForm mode="forgot" /></section></main>;
}
