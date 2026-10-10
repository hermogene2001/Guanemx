"use client";

import { useEffect, useState } from "react";

type ThemeChoice = "dark" | "light" | "system";
const STORAGE_KEY = "guanemx-theme";

function applyTheme(choice: ThemeChoice) {
  const systemLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  const theme = choice === "system" ? (systemLight ? "light" : "dark") : choice;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themeMode = choice;
}

export default function ThemeSelector() {
  const [choice, setChoice] = useState<ThemeChoice>("dark");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial: ThemeChoice = saved === "light" || saved === "system" || saved === "dark" ? saved : "dark";
    setChoice(initial);
    applyTheme(initial);

  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const updateForSystem = () => { if (choice === "system") applyTheme("system"); };
    media.addEventListener("change", updateForSystem);
    return () => media.removeEventListener("change", updateForSystem);
  }, [choice]);

  function selectTheme(value: string) {
    if (value !== "dark" && value !== "light" && value !== "system") return;
    const next = value as ThemeChoice;
    setChoice(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  return <label className="theme-choice"><span>Appearance</span><select aria-label="Color theme" value={choice} onChange={(event) => selectTheme(event.target.value)}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label>;
}
