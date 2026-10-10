import { redirect } from "next/navigation";
import AccountFrame from "@/components/account-frame";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Faccount%2Fmarket");
  const configured = Boolean(process.env.MARKET_DATA_API_KEY);
  return <AccountFrame user={user} activeHref="/account/market"><header className="account-header"><div><span className="label">MARKET VIEW</span><h1>Live market</h1><p>View-only market information. Trading actions are not available here.</p></div></header><section className="finance-card market-provider-state"><span className={`finance-status ${configured ? "completed" : "pending"}`}>{configured ? "Provider configured" : "Provider not configured"}</span><h2>{configured ? "Market data connection is ready to be integrated" : "Market data is not connected"}</h2><p>{configured ? "An authorized market-data provider must be connected before live prices can be shown." : "Set MARKET_DATA_API_KEY and configure an authorized market-data provider before displaying live prices."}</p><p>Prices and charts are not simulated or presented as live market data.</p></section></AccountFrame>;
}
