import { afterEach, describe, expect, it, vi } from "vitest";
import { appBaseUrl, mailDriver, sendMail, verificationLink } from "@/lib/mailer";
import { hashVerificationToken } from "@/lib/verification-tokens";

describe("verification token hashing", () => {
  it("hashes a raw token to a stable 64-character hex digest", () => {
    const token = "raw-token-abc123";
    expect(hashVerificationToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashVerificationToken(token)).toBe(hashVerificationToken(token));
    expect(hashVerificationToken(token)).not.toBe(hashVerificationToken(`${token}x`));
  });
});

describe("mailer helpers", () => {
  afterEach(() => {
    delete process.env.MAIL_DRIVER;
    delete process.env.NEXT_PUBLIC_APP_URL;
    vi.restoreAllMocks();
  });

  it("defaults the mail driver to log", () => {
    expect(mailDriver()).toBe("log");
  });

  it("builds verification links from NEXT_PUBLIC_APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    expect(verificationLink("verify-email", "abc")).toBe("https://app.example.com/verify-email?token=abc");
    expect(verificationLink("reset-password", "abc")).toBe("https://app.example.com/reset-password?token=abc");
    expect(appBaseUrl()).toBe("https://app.example.com");
  });

  it("falls back to localhost when no public URL is configured", () => {
    expect(appBaseUrl()).toBe("http://localhost:3000");
  });

  it("logs a message with the log driver", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await sendMail({ to: "a@example.com", subject: "Hello", text: "Body text" });
    expect(spy).toHaveBeenCalledWith("[mail] to=a@example.com subject=Hello\nBody text");
  });

  it("fails loudly when an unimplemented driver is selected", async () => {
    process.env.MAIL_DRIVER = "smtp";
    await expect(sendMail({ to: "a@example.com", subject: "x", text: "y" })).rejects.toThrow("MAIL_DRIVER=smtp is not configured");
  });
});