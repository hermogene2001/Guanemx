import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  configuredReferralBonusPercent,
  decryptPayoutAccountNumber,
  encryptPayoutAccountNumber,
  kigaliDayStart,
  newReference,
} from "@/lib/finance";

const originalAuthSecret = process.env.AUTH_SECRET;
const originalPayoutKey = process.env.PAYOUT_ENCRYPTION_KEY;
const originalBonus = process.env.REFERRAL_RECHARGE_BONUS_PERCENT;

function random32ByteBase64UrlKey() {
  // Deterministic 32-byte key (hex 00..1f), expressed as base64url.
  return Buffer.from(Array.from({ length: 32 }, (_, index) => index)).toString("base64url");
}

beforeEach(() => {
  process.env.AUTH_SECRET = "x".repeat(32);
});

afterEach(() => {
  process.env.AUTH_SECRET = originalAuthSecret;
  process.env.PAYOUT_ENCRYPTION_KEY = originalPayoutKey;
  process.env.REFERRAL_RECHARGE_BONUS_PERCENT = originalBonus;
});

describe("newReference", () => {
  it("builds a prefix-uuid20 uppercase reference", () => {
    const reference = newReference("RCH");
    expect(reference).toMatch(/^RCH-[A-F0-9]{20}$/);
  });

  it("produces distinct references across calls", () => {
    const seen = new Set(Array.from({ length: 100 }, () => newReference("WDR")));
    expect(seen.size).toBe(100);
  });
});

describe("payout account number encryption", () => {
  it("round-trips an account number with a configured key", () => {
    process.env.PAYOUT_ENCRYPTION_KEY = random32ByteBase64UrlKey();
    const accountNumber = "1234567890123456";
    const encrypted = encryptPayoutAccountNumber(accountNumber);
    expect(encrypted).not.toContain(accountNumber);
    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(decryptPayoutAccountNumber(encrypted)).toBe(accountNumber);
  });

  it("round-trips when falling back to AUTH_SECRET", () => {
    delete process.env.PAYOUT_ENCRYPTION_KEY;
    const accountNumber = "0790123456";
    const encrypted = encryptPayoutAccountNumber(accountNumber);
    expect(decryptPayoutAccountNumber(encrypted)).toBe(accountNumber);
  });

  it("produces a different ciphertext for the same input (random IV)", () => {
    process.env.PAYOUT_ENCRYPTION_KEY = random32ByteBase64UrlKey();
    const first = encryptPayoutAccountNumber("1111222233334444");
    const second = encryptPayoutAccountNumber("1111222233334444");
    expect(first).not.toBe(second);
  });

  it("rejects a key that does not decode to 32 bytes", () => {
    process.env.PAYOUT_ENCRYPTION_KEY = Buffer.from("too-short").toString("base64url");
    expect(() => encryptPayoutAccountNumber("1234")).toThrow(/32 bytes/);
  });

  it("throws on tampered ciphertext", () => {
    process.env.PAYOUT_ENCRYPTION_KEY = random32ByteBase64UrlKey();
    const encrypted = encryptPayoutAccountNumber("0987654321");
    const tampered = encrypted.slice(0, -2) + (encrypted.endsWith("ab") ? "cd" : "ab");
    expect(() => decryptPayoutAccountNumber(tampered)).toThrow();
  });

  it("throws on a malformed payload", () => {
    expect(() => decryptPayoutAccountNumber("not-a-v1-blob")).toThrow(/could not be read/);
  });
});

describe("kigaliDayStart", () => {
  it("returns the start of the Kigali calendar day in UTC for an afternoon instant", () => {
    expect(kigaliDayStart(new Date("2026-10-10T12:00:00Z")).toISOString()).toBe("2026-10-09T22:00:00.000Z");
  });

  it("rolls forward when the local time crosses into the next Kigali day", () => {
    // 23:00 UTC is 01:00 on the next day in Kigali (UTC+2).
    expect(kigaliDayStart(new Date("2026-10-10T23:00:00Z")).toISOString()).toBe("2026-10-10T22:00:00.000Z");
  });

  it("stays stable across two instants in the same Kigali day", () => {
    const first = kigaliDayStart(new Date("2026-10-09T22:30:00Z")); // 00:30 Kigali 10-10
    const second = kigaliDayStart(new Date("2026-10-10T10:00:00Z")); // 12:00 Kigali 10-10
    expect(first.getTime()).toBe(second.getTime());
  });
});

describe("configuredReferralBonusPercent", () => {
  it.each([
    ["0", 0],
    ["15", 15],
    ["100", 100],
    ["150", 0],
    ["-5", 0],
    ["abc", 0],
  ])("clamps %s to %i", (raw, expected) => {
    process.env.REFERRAL_RECHARGE_BONUS_PERCENT = raw;
    expect(configuredReferralBonusPercent()).toBe(expected);
  });

  it("defaults to 0 when unset", () => {
    delete process.env.REFERRAL_RECHARGE_BONUS_PERCENT;
    expect(configuredReferralBonusPercent()).toBe(0);
  });
});