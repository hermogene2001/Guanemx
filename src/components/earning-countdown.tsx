"use client";

import { useEffect, useState } from "react";

type Props = { target: string; daysRemaining: number };

function splitTime(totalSeconds: number) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function formatTime(totalSeconds: number) {
  const { days, hours, minutes, seconds } = splitTime(totalSeconds);
  const pad = (value: number) => String(value).padStart(2, "0");
  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

export default function EarningCountdown({ target, daysRemaining }: Props) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      setSecondsLeft(Math.max(0, Math.floor((new Date(target).getTime() - Date.now()) / 1000)));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [target]);

  if (daysRemaining < 1) return null;

  return (
    <div className="earning-countdown" role="status" aria-live="off">
      <span className="earning-countdown-label">Next earning in</span>
      {secondsLeft === null ? <strong>…</strong> : secondsLeft === 0 ? <strong>Due now — opens your wallet</strong> : <strong key={secondsLeft}>{formatTime(secondsLeft)}</strong>}
    </div>
  );
}