import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const VERIFY_EMAIL_TTL_MS = 24 * 60 * 60 * 1000;
export const RESET_PASSWORD_TTL_MS = 60 * 60 * 1000;

export function hashVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a single-use token for a purpose (e.g. "verify-email",
 * "reset-password"). Only the SHA-256 hash is stored; the raw token is
 * returned once for the email body. Re-issuing for the same (user, purpose)
 * invalidates previous tokens.
 */
export async function createVerificationToken(
  tx: Prisma.TransactionClient,
  userId: string,
  purpose: string,
  ttlMs = VERIFY_EMAIL_TTL_MS,
) {
  await tx.verificationToken.deleteMany({ where: { userId, purpose } });
  const token = randomBytes(32).toString("base64url");
  await tx.verificationToken.create({
    data: {
      userId,
      purpose,
      tokenHash: hashVerificationToken(token),
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  return token;
}

/**
 * Validates and consumes a token in one step (atomic). Returns the user id on
 * success, or null for unknown, expired, or already-used tokens.
 */
export async function consumeVerificationToken(purpose: string, token: string) {
  const tokenHash = hashVerificationToken(token);
  return prisma.$transaction(
    async (tx) => {
      const record = await tx.verificationToken.findUnique({ where: { tokenHash } });
      if (!record || record.purpose !== purpose) return null;
      if (record.usedAt !== null || record.expiresAt <= new Date()) return null;
      await tx.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      return { userId: record.userId };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
