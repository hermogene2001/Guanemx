"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type RobotProduct = {
  name: string;
  slug: string;
  description: string;
  strategyDescription: string;
  market: string;
  riskLevel: string;
  robotType: string;
  tier?: "BEGINNER" | "PRO" | "ADVANCED" | "VIP";
  performanceKind: "SIMULATED" | "HISTORICAL" | "REAL" | null;
  performanceSummary: string | null;
  subscriberCount: number;
  plans: { id: string; name: string; description: string | null; durationDays: number; price: string; currency: string }[];
};

const tabs = ["Performance", "About", "Reviews", "FAQ"] as const;
type Tab = (typeof tabs)[number];

function formatPrice(value: string) {
  return Number(value).toFixed(2).replace(/\.00$/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function RobotArtwork() {
  return <div className="robot-product-art" aria-label="Robot illustration" role="img">
    <svg viewBox="0 0 360 360" aria-hidden="true">
      <defs>
        <linearGradient id="robot-metal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d5e2f0" /><stop offset=".38" stopColor="#71859a" /><stop offset=".72" stopColor="#26384c" /><stop offset="1" stopColor="#9badbf" /></linearGradient>
        <linearGradient id="robot-face" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#1b2b3d" /><stop offset="1" stopColor="#050b13" /></linearGradient>
        <linearGradient id="robot-glow" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#5846bb" /><stop offset="1" stopColor="#37d8f2" /></linearGradient>
        <radialGradient id="robot-light"><stop stopColor="#2a4a62" stopOpacity=".8" /><stop offset="1" stopColor="#07111d" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="182" cy="318" rx="135" ry="26" fill="#020711" opacity=".8" />
      <ellipse cx="170" cy="155" rx="160" ry="152" fill="url(#robot-light)" />
      <path d="M88 282c11-61 47-91 94-96 51-5 93 27 105 96l-25 27H94z" fill="url(#robot-metal)" stroke="#b7c7d8" strokeOpacity=".4" strokeWidth="2" />
      <path d="m131 231 48 36 52-37 17 54-41 35h-63l-38-35z" fill="#182838" stroke="#647a91" strokeWidth="2" />
      <path d="m144 251 35 26 38-27-11 54h-50z" fill="#0c1522" stroke="#263c52" strokeWidth="2" />
      <path d="M119 80c12-38 45-58 83-52 44 7 70 38 71 82l-7 86c-3 42-35 72-80 71-46-1-73-29-78-72l-9-74c-2-16 3-29 20-41Z" fill="url(#robot-metal)" stroke="#d6e4f2" strokeOpacity=".65" strokeWidth="3" />
      <path d="M136 91c9-22 26-34 53-34 30 0 50 17 54 47l-6 82c-3 34-21 53-51 53-31 0-49-18-52-51l-6-72c-1-10 1-18 8-25Z" fill="url(#robot-face)" stroke="#738ba4" strokeWidth="3" />
      <path d="M122 103c-20 7-27 24-24 45l8 40c3 11 11 18 20 19l-7-104Zm137-1c19 9 25 25 20 47l-9 38c-3 11-10 17-19 19l8-104Z" fill="#25384d" stroke="#8498ad" strokeWidth="3" />
      <path d="M135 136c17-10 31-9 45 0l-3 8c-14-5-26-5-39 1zm67 0c15-9 29-9 44 0l-4 9c-13-6-25-6-38 0z" fill="#0b1420" />
      <path d="M142 140c12-7 22-6 31 0l-2 4c-10-3-18-3-28 1zm68 0c10-6 19-6 29 0l-2 5c-10-4-18-4-27 0z" fill="url(#robot-glow)" />
      <path d="m174 164 10 6-9 25h19l-1 7-30-1 12-28-10-5z" fill="#526b81" />
      <path d="M155 213c15 8 34 9 51 0" fill="none" stroke="#61798e" strokeWidth="3" strokeLinecap="round" />
      <circle cx="112" cy="148" r="19" fill="#152436" stroke="#93a8bb" strokeWidth="4" /><circle cx="112" cy="148" r="8" fill="#07101a" stroke="#39d9f3" strokeWidth="2" />
      <path d="M142 55 135 38m84 14 10-18" stroke="#c8d9e9" strokeWidth="3" strokeLinecap="round" />
      <circle cx="134" cy="36" r="4" fill="#5846bb" /><circle cx="231" cy="31" r="4" fill="#35d9f2" />
    </svg>
    <span className="robot-art-caption">GUANEMX · AUTOMATED STRATEGY</span>
  </div>;
}

function PerformanceContent({ robot }: { robot: RobotProduct }) {
  return <div className="product-performance-layout">
    <section className="product-chart-card"><div className="product-chart-heading"><div><span className="label">PERFORMANCE HISTORY</span><h2>Performance chart</h2></div><span className="product-chart-period">NO DATA</span></div>
      <div className="product-chart-empty"><div className="product-chart-grid" aria-hidden="true" /><div className="product-chart-empty-message"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17 8 12l4 3 8-9M15 6h5v5" /></svg></span><strong>No verified chart data yet</strong><p>{robot.performanceSummary || "Performance history has not been added for this strategy."}</p>{robot.performanceKind && <small>Data type: {robot.performanceKind.toLowerCase()}</small>}</div></div>
      <p className="product-disclaimer">Performance information is not a guarantee of future results. Trading involves risk.</p>
    </section>
    <aside className="product-stat-card"><span className="label">STRATEGY OVERVIEW</span><div><small>Subscriptions</small><strong>{String(robot.subscriberCount).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</strong></div><div><small>Available plans</small><strong>{robot.plans.length}</strong></div><div><small>Risk level</small><strong className="product-risk-value">{robot.riskLevel}</strong></div><div><small>Market</small><strong>{robot.market}</strong></div></aside>
  </div>;
}

export default function RobotProductView({ robot }: { robot: RobotProduct }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Performance");
  const [planId, setPlanId] = useState(robot.plans[0]?.id ?? "");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutNotice, setCheckoutNotice] = useState("");
  const [checkoutKey, setCheckoutKey] = useState("");
  const selectedPlan = robot.plans.find((plan) => plan.id === planId) ?? robot.plans[0];
  const tier = robot.tier ?? "BEGINNER";

  async function subscribe() {
    if (!selectedPlan || checkoutBusy) return;
    setCheckoutBusy(true);
    setCheckoutError("");
    setCheckoutNotice("");
    const idempotencyKey = checkoutKey || crypto.randomUUID();
    setCheckoutKey(idempotencyKey);
    try {
      const response = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlan.id, idempotencyKey }),
      });
      const result = await response.json() as { error?: string; subscription?: { expiresAt?: string | null } };
      if (!response.ok) {
        if (response.status === 401) {
          router.push(`/login?next=${encodeURIComponent(`/robots/${robot.slug}`)}`);
          return;
        }
        setCheckoutError(result.error ?? "Subscription checkout could not be completed.");
        return;
      }
      setCheckoutKey("");
      setCheckoutNotice(`Subscription active${result.subscription?.expiresAt ? ` until ${new Date(result.subscription.expiresAt).toLocaleDateString()}` : ""}.`);
      router.refresh();
    } catch {
      setCheckoutError("Unable to reach GuanemX. Check your connection and try again.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  return <div className="robot-product-page">
    <div className="robot-product-topline"><Link href="/robots">← <span>Back to marketplace</span></Link><span className="product-breadcrumb">ROBOT MARKETPLACE <b>/</b> {tier}</span></div>
    <section className="robot-product-hero">
      <RobotArtwork />
      <div className="robot-product-info"><div className="robot-product-tags"><span className={`tier-tag tier-${tier.toLowerCase()}`}>{tier}</span><span>{robot.robotType}</span><span>{robot.market}</span><span>{robot.riskLevel} risk</span></div><h1>{robot.name}</h1><p className="robot-product-summary">{robot.description}</p>
        <div className="robot-product-facts"><div><small>Duration</small><strong>{selectedPlan.durationDays} days</strong></div><div><small>Price</small><strong>{selectedPlan.currency} {formatPrice(selectedPlan.price)}</strong></div><div><small>Risk level</small><strong>{robot.riskLevel}</strong></div><div><small>Strategy type</small><strong>{robot.robotType}</strong></div></div>
        <label className="product-plan-select">Choose a plan<select value={planId} onChange={(event) => setPlanId(event.target.value)}>{robot.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.currency} {formatPrice(plan.price)} · {plan.durationDays} days</option>)}</select></label>
      </div>
      <div className="product-checkout-actions">
        <button className="product-subscribe-button" type="button" onClick={() => void subscribe()} disabled={!selectedPlan || checkoutBusy || Boolean(checkoutNotice)}>{checkoutBusy ? "Processing…" : checkoutNotice ? "Subscription active" : "Subscribe now"}{selectedPlan && <span> · RWF {formatPrice(selectedPlan.price)} from Main Balance</span>}</button>
        {checkoutError && <p className="auth-error" role="alert">{checkoutError} {checkoutError.includes("Main Balance") && <Link href="/account/recharge">Recharge</Link>}</p>}
        {checkoutNotice && <p className="finance-success" role="status">{checkoutNotice} <Link href="/account/my-robots">View My Robots</Link></p>}
        <small className="product-checkout-disclaimer">One-time charge. This subscription does not guarantee trading returns.</small>
      </div>
    </section>

    <nav className="product-tabs" aria-label="Robot information">{tabs.map((item) => <button className={tab === item ? "product-tab active" : "product-tab"} key={item} onClick={() => setTab(item)} type="button" aria-current={tab === item ? "page" : undefined}>{item}{item === "Reviews" && <span>0</span>}</button>)}</nav>
    {tab === "Performance" && <PerformanceContent robot={robot} />}
    {tab === "About" && <section className="product-tab-panel"><span className="label">ABOUT THIS STRATEGY</span><h2>How {robot.name} works</h2><p>{robot.strategyDescription}</p><div className="product-about-facts"><div><small>Market</small><strong>{robot.market}</strong></div><div><small>Robot type</small><strong>{robot.robotType}</strong></div><div><small>Risk level</small><strong>{robot.riskLevel}</strong></div><div><small>Plans</small><strong>{robot.plans.length} subscription {robot.plans.length === 1 ? "option" : "options"}</strong></div></div></section>}
    {tab === "Reviews" && <section className="product-tab-panel product-empty-panel"><span className="label">CLIENT REVIEWS</span><h2>No reviews yet</h2><p>Reviews will appear here when clients can submit feedback about this strategy.</p></section>}
    {tab === "FAQ" && <section className="product-tab-panel product-faq"><span className="label">FREQUENTLY ASKED QUESTIONS</span><h2>Before you subscribe</h2><details open><summary>Does this robot guarantee returns?</summary><p>No. No robot can guarantee returns. Trading involves risk, and you may lose money.</p></details><details><summary>How long does a plan last?</summary><p>The duration depends on the subscription plan you select above. Renewals are not automatic.</p></details><details><summary>Is performance history available?</summary><p>{robot.performanceSummary || "No verified performance history has been provided for this robot yet."}</p></details></section>}
  </div>;
}
