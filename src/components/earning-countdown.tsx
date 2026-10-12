"use client";

import { useEffect, useState } from "react";

type Props = { target: string; daysRemaining: number };

function formatRemaining(diffMs: number) {
  if (diffMs <= 0) return "Earning due now";
  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Next earning in ${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `Next earning in ${hours}h ${minutes}m`;
  if (minutes > 0) return `Next earning in ${minutes}m`;
  return "Next earning in <1m";
}

export default function EarningCountdown({ target, daysRemaining }: Props) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setLabel(formatRemaining(new Date(target).getTime() - Date.now()));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [target]);

  if (daysRemaining < 1) return null;
  return <small role="status">{label ?? "Next earning…"}</small>;
}