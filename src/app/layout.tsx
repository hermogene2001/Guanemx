import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GuanemX | Explore trading strategies",
  description: "Explore automated trading robots, compare strategy and risk information, and manage subscriptions in one platform.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const initializeTheme = `(()=>{try{const p=localStorage.getItem("guanemx-theme");const c=p==="light"||p==="dark"||p==="system"?p:"dark";const t=c==="system"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):c;document.documentElement.dataset.theme=t;document.documentElement.dataset.themeMode=c}catch{document.documentElement.dataset.theme="dark"}})()`;
  return <html lang="en" data-theme="dark" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: initializeTheme }} /></head><body suppressHydrationWarning>{children}</body></html>;
}
