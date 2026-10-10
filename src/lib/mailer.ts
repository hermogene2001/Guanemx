export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

/**
 * Mail delivery is pluggable via MAIL_DRIVER. `log` is development-only;
 * `resend` sends through the Resend email API when configured.
 */
export function mailDriver() {
  return (process.env.MAIL_DRIVER ?? "log").trim().toLowerCase();
}

export async function sendMail(message: MailMessage) {
  const driver = mailDriver();
  if (driver === "log") {
    if (process.env.NODE_ENV === "production") throw new Error("MAIL_DRIVER=log is not allowed in production.");
    console.log(`[mail] to=${message.to} subject=${message.subject}\n${message.text}`);
    return;
  }
  if (driver === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.MAIL_FROM;
    if (!apiKey || !from) throw new Error("MAIL_DRIVER=resend requires RESEND_API_KEY and MAIL_FROM.");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Resend email delivery failed with status ${response.status}.`);
    return;
  }
  throw new Error(
    `MAIL_DRIVER=${driver} is not supported. Configure "resend" or use "log" for local development.`,
  );
}

export function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}

/**
 * The public-facing link for a verification flow, consumed by the
 * server-rendered /verify-email and /reset-password pages.
 */
export function verificationLink(purpose: "verify-email" | "reset-password", token: string) {
  const path = purpose === "verify-email" ? "/verify-email" : "/reset-password";
  return `${appBaseUrl()}${path}?token=${encodeURIComponent(token)}`;
}
