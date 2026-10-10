import Link from "next/link";

type Props = { href?: string; className?: string };

export default function BrandLogo({ href = "/", className = "" }: Props) {
  return <Link className={`brand brand-lockup ${className}`.trim()} href={href} aria-label="GuanemX home">
    <svg className="brand-symbol" viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 2.8 36 12v16L20 37.2 4 28V12z" fill="#0a1220" stroke="#5846bb" strokeWidth="1.6" />
      <path d="M10.5 25.5v-5m6 5v-9m6 9v-12m6 12v-16" fill="none" stroke="#8d7ce0" strokeLinecap="round" strokeWidth="3.2" />
      <path d="m10 16 7-5 6 2 8-7m-5 0h5v5" fill="none" stroke="#d5a928" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <circle cx="31" cy="6" r="1.5" fill="#f0ca5b" />
    </svg>
    <span className="brand-word">guanem<span className="brand-accent">x</span></span>
  </Link>;
}
