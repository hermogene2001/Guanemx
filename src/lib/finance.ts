import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

export const RWF = "RWF";

export function newReference(prefix: string) {
  return `${prefix}-${randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;
}

export async function chooseActiveAgent(tx: Prisma.TransactionClient, requirePhone = false) {
  const agents = await tx.user.findMany({
    where: { role: "AGENT", status: "ACTIVE", ...(requirePhone ? { phone: { not: null } } : {}) },
    select: { id: true },
  });
  if (!agents.length) return null;
  return agents[randomInt(agents.length)].id;
}

function payoutEncryptionKey() {
  const configuredKey = process.env.PAYOUT_ENCRYPTION_KEY;
  if (configuredKey) {
    const key = Buffer.from(configuredKey, "base64url");
    if (key.byteLength !== 32) throw new Error("PAYOUT_ENCRYPTION_KEY must decode to 32 bytes.");
    return key;
  }
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Payout encryption is not configured.");
  return createHash("sha256").update(`guanemx:payout-destination:v1:${secret}`).digest();
}

export function encryptPayoutAccountNumber(accountNumber: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", payoutEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(accountNumber, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptPayoutAccountNumber(encrypted: string) {
  const [version, iv, tag, ciphertext] = encrypted.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Payout account data could not be read.");
  const decipher = createDecipheriv("aes-256-gcm", payoutEncryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function kigaliDayStart(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kigali", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(value("year"), value("month") - 1, value("day")) - 2 * 60 * 60 * 1000);
}

export async function recordAudit(
  tx: Prisma.TransactionClient,
  request: Request,
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue,
) {
  const ipAddress = request.headers.get("x-real-ip")?.slice(0, 64)
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64)
    ?? null;
  await tx.auditLog.create({ data: {
    actorUserId, action, entityType, entityId, metadata, ipAddress,
    userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
  } });
}

export function configuredReferralBonusPercent() {
  const parsed = Number(process.env.REFERRAL_RECHARGE_BONUS_PERCENT ?? "0");
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 0;
}

export function formatRwf(value: Prisma.Decimal | number | string) {
  return Number(value).toLocaleString("en-RW", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
