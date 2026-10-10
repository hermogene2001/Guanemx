"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Tier = "BEGINNER" | "PRO" | "ADVANCED" | "VIP";
type MarketplaceRobot = {
  id: string;
  name: string;
  slug: string;
  description: string;
  strategyDescription: string;
  market: string;
  riskLevel: string;
  robotType: string;
  tier: Tier;
  plans: { id: string; name: string; durationDays: number; price: string; currency: string }[];
};

const filters: { label: string; value: Tier | "ALL" }[] = [
  { label: "All Robots", value: "ALL" },
  { label: "Beginner", value: "BEGINNER" },
  { label: "Pro", value: "PRO" },
  { label: "Advanced", value: "ADVANCED" },
  { label: "VIP", value: "VIP" },
];

function formatPrice(value: string) {
  return Number(value).toFixed(2).replace(/\.00$/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function RobotPortrait({ tier, slug }: { tier: Tier; slug: string }) {
  return <div className={`market-robot-portrait tier-${tier.toLowerCase()}`} role="img" aria-label={`${tier.toLowerCase()} strategy robot illustration`}>
    <span className="market-robot-glow" />
    <svg viewBox="0 0 120 140" aria-hidden="true">
      <defs><linearGradient id={`metal-${slug}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d9e4f0" /><stop offset=".48" stopColor="#70849a" /><stop offset="1" stopColor="#233448" /></linearGradient><linearGradient id={`lens-${slug}`}><stop stopColor="#5543ba" /><stop offset="1" stopColor="#50dcf2" /></linearGradient></defs>
      <ellipse cx="60" cy="131" rx="42" ry="7" fill="#020711" opacity=".8" />
      <path d="M22 125c3-22 14-35 38-37 24 2 35 15 38 37l-13 6H35z" fill={`url(#metal-${slug})`} stroke="#b7c8d8" strokeWidth="1.4" />
      <path d="M38 90 60 108l22-18 9 30-14 10H44l-14-10z" fill="#172739" stroke="#61778e" strokeWidth="1.5" />
      <path d="M34 34c4-18 16-27 30-26 17 1 28 15 28 32l-3 36c-2 16-12 26-29 26S34 91 32 75l-3-29c-1-5 1-9 5-12Z" fill={`url(#metal-${slug})`} stroke="#cbd8e5" strokeWidth="1.7" />
      <path d="M41 39c3-10 10-15 21-15 13 0 21 7 22 19l-2 31c-1 13-8 19-20 19S43 86 42 74l-3-27c0-4 0-6 2-8Z" fill="#091320" stroke="#788da3" strokeWidth="1.5" />
      <path d="m42 50 17-1-1 5-16 1zm22-1 17 1-1 5-16-1z" fill="#020812" />
      <path d="m43 51 14-1-1 3-13 1zm22-1 13 1-1 3-13-1z" fill={`url(#lens-${slug})`} />
      <path d="m59 60 5 4-5 10h10v4H53l6-12-5-4z" fill="#63798e" />
      <path d="M54 83c5 3 10 3 15 0" fill="none" stroke="#70869b" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="34" cy="61" r="9" fill="#152438" stroke="#9badbf" strokeWidth="2" /><circle cx="34" cy="61" r="3.5" fill="#07101a" stroke="#52d8ed" strokeWidth="1" />
    </svg>
  </div>;
}

export default function RobotMarketplace({ robots }: { robots: MarketplaceRobot[] }) {
  const [tier, setTier] = useState<Tier | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return robots.filter((robot) => (tier === "ALL" || robot.tier === tier)
      && (!normalized || `${robot.name} ${robot.market} ${robot.robotType} ${robot.description}`.toLowerCase().includes(normalized)));
  }, [robots, tier, query]);

  return <>
    <div className="marketplace-toolbar"><div className="marketplace-filters" role="group" aria-label="Filter robots by tier">{filters.map((item) => <button className={tier === item.value ? "marketplace-filter active" : "marketplace-filter"} key={item.value} onClick={() => setTier(item.value)} type="button">{item.label}</button>)}</div><label className="marketplace-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg><input aria-label="Search robots" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search robots..." /></label></div>
    {filtered.length === 0 ? <section className="market-empty marketplace-no-results"><h2>{robots.length ? "No matching robots" : "No robots are listed yet"}</h2><p>{robots.length ? "Try another category or search term." : "Published robot strategies with an active plan will appear here."}</p></section> : <section className="marketplace-robot-list" aria-label="Robot listings">{filtered.map((robot) => {
      const plan = robot.plans[0];
      return <article className="marketplace-robot-row" key={robot.id}>
        <RobotPortrait tier={robot.tier} slug={robot.slug} />
        <div className="marketplace-robot-info"><div className="marketplace-robot-title"><h2>{robot.name}</h2><span className={`tier-tag tier-${robot.tier.toLowerCase()}`}>{robot.tier}</span></div><p>{robot.description}</p><small>{robot.robotType} · {robot.market} · {robot.riskLevel} risk</small></div>
        <div className="marketplace-plan-fact"><strong>{plan.durationDays} Days</strong><small>Duration</small></div>
        <div className="marketplace-plan-fact marketplace-price"><strong>{plan.currency} {formatPrice(plan.price)}</strong><small>Price · {robot.plans.length} {robot.plans.length === 1 ? "plan" : "plans"}</small></div>
        <Link className="button marketplace-view-button" href={`/robots/${robot.slug}`}>View Details</Link>
      </article>;
    })}</section>}
    <p className="marketplace-result-count">Showing {filtered.length} of {robots.length} {robots.length === 1 ? "robot" : "robots"}</p>
  </>;
}
