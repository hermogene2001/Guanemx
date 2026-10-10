"use client";

import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }
  return <button className="account-signout" onClick={signOut} type="button">Sign out</button>;
}
