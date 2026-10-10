export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

/**
 * Mail delivery is pluggable via MAIL_DRIVER:
 * - "log" (default): prints the message to stdout. Intended for development;
 *   nothing is delivered, which is honest for a project with no provider set up.
 * - "smtp": not implemented yet. Selecting it fails loudly rather than silently
 *   pretending to send mail.
 */
export function mailDriver() {
  return (process.env.MAIL_DRIVER ?? "log").trim().toLowerCase();
}

export async function sendMail(message: MailMessage) {
  const driver = mailDriver();
  if (driver === "log") {
    console.log(`[mail] to=${message.to} subject=${message.subject}\n${message.text}`);
    return;
  }
  throw new Error(
    `MAIL_DRIVER=${driver} is not configured yet. Add SMTP_* environment variables and a sendMail implementation for it (future work).`,
  );
}

export function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}

/**
 * The public-facing link for a verification flow. The UI pages
 * (/verify-email, /reset-password) are not built yet; the API contract below is.
 */
export function verificationLink(purpose: "verify-email" | "reset-password", token: string) {
  const path = purpose === "verify-email" ? "/verify-email" : "/reset-password";
  return `${appBaseUrl()}${path}?token=${encodeURIComponent(token)}`;
}