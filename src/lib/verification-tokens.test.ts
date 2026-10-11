import { afterEach, describe, expect, it, vi } from "vitest";
import { appBaseUrl, mailDriver, sendMail, verificationLink } from "@/lib/mailer";
import { hashVerificationToken } from "@/lib/verification-tokens";

const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn() }));

vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: sendMailMock })) },
}));

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
    delete process.env.RESEND_API_KEY;
    delete process.env.MAIL_FROM;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    sendMailMock.mockReset();
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
    process.env.MAIL_DRIVER = "carrier-pigeon";
    await expect(sendMail({ to: "a@example.com", subject: "x", text: "y" })).rejects.toThrow(
      "MAIL_DRIVER=carrier-pigeon is not supported",
    );
  });

  it("requires SMTP configuration before using the smtp driver", async () => {
    process.env.MAIL_DRIVER = "smtp";
    process.env.MAIL_FROM = "GuanemX <noreply@example.com>";
    await expect(sendMail({ to: "a@example.com", subject: "x", text: "y" })).rejects.toThrow(
      "requires SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and MAIL_FROM",
    );
  });

  it("sends through SMTP when configured", async () => {
    sendMailMock.mockResolvedValueOnce(undefined);
    process.env.MAIL_DRIVER = "smtp";
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "sender@example.com";
    process.env.SMTP_PASSWORD = "app-password";
    process.env.MAIL_FROM = "GuanemX <sender@example.com>";

    await sendMail({ to: "recipient@example.com", subject: "Verify", text: "Body" });

    expect(sendMailMock).toHaveBeenCalledWith({
      from: "GuanemX <sender@example.com>",
      to: "recipient@example.com",
      subject: "Verify",
      text: "Body",
    });
  });

  it("requires API configuration before using the resend driver", async () => {
    process.env.MAIL_DRIVER = "resend";
    delete process.env.RESEND_API_KEY;
    delete process.env.MAIL_FROM;
    await expect(sendMail({ to: "a@example.com", subject: "x", text: "y" })).rejects.toThrow("requires RESEND_API_KEY and MAIL_FROM");
  });
});