export function AuthTrustBar() {
  return <footer className="auth-trustbar">
    <div><span className="auth-trust-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17 8 12l4 3 8-9m-5 0h5v5" /></svg></span><span><strong>Live market</strong><small>Market information in one place</small></span></div>
    <div><span className="auth-trust-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5" /></svg></span><span><strong>Robot strategies</strong><small>Review plans and risk details</small></span></div>
    <div><span className="auth-trust-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></svg></span><span><strong>Account security</strong><small>Protected sign-in and account access</small></span></div>
    <p>Trading involves risk. No return is guaranteed.</p>
  </footer>;
}

export default function AuthTradingArt() {
  return <aside className="auth-art-panel" aria-label="GuanemX market strategies">
    <div className="auth-art-heading"><span className="auth-live-dot" />MARKET INSIGHT <span>·</span> STRATEGY ACCESS</div>
    <svg className="auth-bull-art" viewBox="0 0 620 570" role="img" aria-label="Bull in front of a rising market chart">
      <defs>
        <linearGradient id="bull-metal" x1=".1" y1="0" x2=".9" y2="1"><stop stopColor="#b3d0bc" /><stop offset=".28" stopColor="#406b54" /><stop offset=".63" stopColor="#172a25" /><stop offset="1" stopColor="#07110f" /></linearGradient>
        <linearGradient id="bull-highlight" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b5e5bd" stopOpacity=".72" /><stop offset="1" stopColor="#307b50" stopOpacity="0" /></linearGradient>
        <linearGradient id="candle-up" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#45d878" /><stop offset="1" stopColor="#186740" /></linearGradient>
        <radialGradient id="bull-aura"><stop stopColor="#164c35" stopOpacity=".7" /><stop offset="1" stopColor="#03100c" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="350" cy="323" rx="250" ry="240" fill="url(#bull-aura)" />
      <g className="auth-candles" opacity=".82">
        <path d="M51 290v-73m43 55v-92m43 49v-99m43 42v-112m43 74v-96m43 40V75m43 33V65m43 41V49m43 47V37m43 39V18m43 40V5m43 18V0" stroke="#42b875" strokeWidth="2" />
        <rect x="44" y="235" width="14" height="31" rx="2" fill="url(#candle-up)" /><rect x="87" y="203" width="14" height="42" rx="2" fill="url(#candle-up)" /><rect x="130" y="172" width="14" height="29" rx="2" fill="url(#candle-up)" /><rect x="173" y="135" width="14" height="37" rx="2" fill="url(#candle-up)" /><rect x="216" y="106" width="14" height="28" rx="2" fill="url(#candle-up)" /><rect x="259" y="81" width="14" height="26" rx="2" fill="url(#candle-up)" /><rect x="302" y="80" width="14" height="18" rx="2" fill="#bf4c59" /><rect x="345" y="62" width="14" height="22" rx="2" fill="url(#candle-up)" /><rect x="388" y="51" width="14" height="20" rx="2" fill="url(#candle-up)" /><rect x="431" y="28" width="14" height="23" rx="2" fill="url(#candle-up)" /><rect x="474" y="25" width="14" height="14" rx="2" fill="#bd4c5d" /><rect x="517" y="6" width="14" height="20" rx="2" fill="url(#candle-up)" />
      </g>
      <path className="auth-chart-trail-glow" pathLength="1000" d="M32 318c38-6 46-37 82-35s38 16 68-10 42-17 72-33 45 13 75-10 36-12 68-44 42 8 72-29 43-6 70-35 34 4 58-37" />
      <path className="auth-chart-trail" pathLength="1000" d="M32 318c38-6 46-37 82-35s38 16 68-10 42-17 72-33 45 13 75-10 36-12 68-44 42 8 72-29 43-6 70-35 34 4 58-37" />
      <path d="M109 475c61-27 89-54 111-112 13-34 14-69 4-103-6-21-3-48 17-67 10-10 22-16 37-17 13-1 24 6 34 14l27-18c11-7 24-8 37-3l20 8 34-17c17-8 38-3 48 13l27 42c16 25 20 56 13 86l-13 58c-6 29-3 53 11 77l34 58H165z" fill="url(#bull-metal)" stroke="#74a58a" strokeOpacity=".55" strokeWidth="3" />
      <path d="M231 259c-30-13-48-9-62 7l-25 8 17 12-3 16 34 5 22-14z" fill="url(#bull-metal)" stroke="#90b69d" strokeWidth="3" />
      <path d="M189 269c-19 3-26 8-36 18l25 8 20-8z" fill="#101a18" />
      <path d="M209 223c-15-27-12-47 2-66 7-9 17-17 30-19-20-25-14-47 5-68 4 29 18 42 37 48" fill="none" stroke="#a4bea9" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M276 143c-3-28 6-46 27-61-3 26 4 42 22 58" fill="none" stroke="#779d83" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M229 197c14-17 35-24 55-18l32 14-20 63-44 33-29-32z" fill="url(#bull-highlight)" opacity=".66" />
      <path d="M277 206c21-14 46-12 65 1l-5 12c-19-7-35-7-54 2z" fill="#06100d" />
      <path d="M289 207c12-8 25-8 39-1l-4 7c-12-4-22-4-34 1z" fill="#b2d8bd" />
      <circle cx="307" cy="210" r="3.2" fill="#59e590" />
      <path d="M326 245c16 5 31 2 42-10" fill="none" stroke="#a0b9a7" strokeWidth="4" strokeLinecap="round" />
      <path d="M222 385c23 2 47 21 59 44l-14 93h-53l-14-87-30 85h-46l11-121c4-30 33-47 65-44z" fill="#19352a" stroke="#547d62" strokeWidth="3" />
      <path d="M391 377c29-7 56 12 60 40l16 104h-49l-28-72-4 75h-48l-6-104c-2-24 17-38 39-43z" fill="#15291f" stroke="#547d62" strokeWidth="3" />
      <path d="M202 521h58l-6 17h-66zm210 0h58l7 17h-63z" fill="#07100e" stroke="#73947c" strokeWidth="2" />
      <path d="M444 225c29-19 49-18 63-5-19 2-28 11-34 25" fill="none" stroke="#52775c" strokeWidth="8" strokeLinecap="round" />
      <path d="M180 479h28m-9 23h37m155-19h28m-31 22h26" stroke="#87ad91" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round" />
    </svg>
    <div className="auth-art-caption"><span>GUANEMX</span><strong>Build with a clearer view of the market.</strong><small>Compare strategies, plan terms, and account activity.</small></div>
    <span className="auth-art-orbit orbit-one" /><span className="auth-art-orbit orbit-two" />
  </aside>;
}
