import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compare } from "bcryptjs";
import type { MockInstance } from "vitest";

import { POST as verifyEmail } from "@/app/api/auth/verify-email/route";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { prisma } from "@/lib/prisma";
import { createVerificationToken } from "@/lib/verification-tokens";
import { cleanupDatabase, createUser, makeRequest } from "./helpers";

describe("email verification and password reset (integration)", () => {
  let mailSpy: MockInstance<(...args: unknown[]) => void>;

  beforeEach(async () => {
    await cleanupDatabase();
    mailSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mailText() {
    return mailSpy.mock.calls.map((call) => call.join(" ")).join("\n");
  }

  function tokenFromMail(path: "verify-email" | "reset-password") {
    return mailText().match(new RegExp(`${path}\\?token=([^\\s&]+)`))?.[1] ?? null;
  }

  it("activates the account when the email verification token is valid", async () => {
    const user = await createUser({ status: "PENDING_VERIFICATION" });
    const token = await createVerificationToken(prisma, user.id, "verify-email");

    const res = await verifyEmail(makeRequest("/api/auth/verify-email", { body: { token } }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.status).toBe("ACTIVE");
    expect(updated.emailVerifiedAt).not.toBeNull();
    await expect(prisma.auditLog.count({ where: { action: "account.email_verified" } })).resolves.toBe(1);
  });

  it("rejects an unknown verification token", async () => {
    const user = await createUser({ status: "PENDING_VERIFICATION" });
    await createVerificationToken(prisma, user.id, "verify-email");

    const res = await verifyEmail(makeRequest("/api/auth/verify-email", { body: { token: "does-not-exist-123456789012345678901234567890" } }));
    expect(res.status).toBe(400);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.status).toBe("PENDING_VERIFICATION");
  });

  it("lets each token be used only once", async () => {
    const user = await createUser({ status: "PENDING_VERIFICATION" });
    const token = await createVerificationToken(prisma, user.id, "verify-email");

    const first = await verifyEmail(makeRequest("/api/auth/verify-email", { body: { token } }));
    const second = await verifyEmail(makeRequest("/api/auth/verify-email", { body: { token } }));
    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
  });

  it("rejects an expired verification token", async () => {
    const user = await createUser({ status: "PENDING_VERIFICATION" });
    const token = await createVerificationToken(prisma, user.id, "verify-email", -1000);

    const res = await verifyEmail(makeRequest("/api/auth/verify-email", { body: { token } }));
    expect(res.status).toBe(400);
  });

  it("does not reveal whether an email exists when requesting a reset", async () => {
    const known = await createUser();
    await forgotPassword(makeRequest("/api/auth/forgot-password", { body: { email: known.email } }));
    const unknown = await forgotPassword(makeRequest("/api/auth/forgot-password", { body: { email: "nobody@example.com" } }));
    expect(unknown.status).toBe(200);
    expect(await unknown.json()).toEqual({ ok: true });
    expect(mailText()).toContain(`to=${known.email}`);
  });

  it("resets the password, revokes sessions, and marks the token used", async () => {
    const user = await createUser();
    await prisma.userSession.create({
      data: { userId: user.id, tokenHash: `hash-${user.id}`, expiresAt: new Date(Date.now() + 60_000) },
    });

    const requested = await forgotPassword(makeRequest("/api/auth/forgot-password", { body: { email: user.email } }));
    expect(requested.status).toBe(200);
    const token = tokenFromMail("reset-password");
    expect(token).not.toBeNull();

    const res = await resetPassword(makeRequest("/api/auth/reset-password", { body: { token, password: "brand-new-password-123" } }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await compare("brand-new-password-123", updated.passwordHash)).toBe(true);
    expect(await compare("old-password-that-was-never-set", updated.passwordHash)).toBe(false);
    await expect(prisma.userSession.count({ where: { userId: user.id, revokedAt: null } })).resolves.toBe(0);

    const reuse = await resetPassword(makeRequest("/api/auth/reset-password", { body: { token, password: "another-password-123" } }));
    expect(reuse.status).toBe(400);
    await expect(prisma.auditLog.count({ where: { action: "account.password_reset" } })).resolves.toBe(1);
  });

  it("rejects an expired reset token", async () => {
    const user = await createUser();
    const token = await createVerificationToken(prisma, user.id, "reset-password", -1000);
    const res = await resetPassword(makeRequest("/api/auth/reset-password", { body: { token, password: "brand-new-password-123" } }));
    expect(res.status).toBe(400);
  });

  it("rejects a reset password shorter than 12 characters", async () => {
    const user = await createUser();
    const token = await createVerificationToken(prisma, user.id, "reset-password");
    const res = await resetPassword(makeRequest("/api/auth/reset-password", { body: { token, password: "short" } }));
    expect(res.status).toBe(400);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await compare("short", updated.passwordHash)).toBe(false);
  });
});