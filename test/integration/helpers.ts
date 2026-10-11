import { NextRequest } from "next/server";
import { Prisma, type UserRole, type UserStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptPayoutAccountNumber } from "@/lib/finance";
import { CURRENCY } from "@/lib/money";

export const API_ORIGIN = "http://localhost";

export type CurrentUser = { id: string; name: string; email: string; role: UserRole; status: UserStatus } | null;

/**
 * Sets the fake session user. Requires the test file to have mocked
 * @/lib/auth (see the vi.mock blocks in the integration test files).
 */
export function setCurrentUser(user: CurrentUser) {
  (getCurrentUser as unknown as { mockResolvedValue(value: CurrentUser): Promise<unknown> }).mockResolvedValue(user);
}

export function makeRequest(
  urlPath: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string>; ip?: string } = {},
) {
  const url = `${API_ORIGIN}${urlPath}`;
  const headers = new Headers(init.headers);
  headers.set("origin", API_ORIGIN);
  headers.set("x-real-ip", init.ip ?? "203.0.113.10");
  const body = init.body === undefined ? undefined : JSON.stringify(init.body);
  return new NextRequest(url, { method: init.method ?? "POST", headers, body });
}

export function requestWithoutOrigin(urlPath = "/api/recharges") {
  return new NextRequest(`${API_ORIGIN}${urlPath}`, { method: "POST", headers: { "x-real-ip": "203.0.113.10" } });
}

export function reviewParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

export async function createUser(overrides: { role?: UserRole; status?: UserStatus; phone?: string | null; invitedById?: string | null; email?: string } = {}) {
  const email = overrides.email ?? `user-${crypto.randomUUID()}@example.com`;
  return prisma.user.create({
    data: {
      name: "Aime Test",
      email,
      phone: overrides.phone ?? null,
      passwordHash: "not-used-in-tests",
      role: overrides.role ?? "USER",
      status: overrides.status ?? "ACTIVE",
      invitedById: overrides.invitedById ?? null,
    },
  });
}

export async function createAgent(overrides: { phone?: string } = {}) {
  return createUser({ role: "AGENT", phone: overrides.phone ?? "250788000001", status: "ACTIVE" });
}

export async function createWallet(userId: string, availableBalance: Prisma.Decimal | number = new Prisma.Decimal(0), currency = CURRENCY) {
  const balance = availableBalance instanceof Prisma.Decimal ? availableBalance : new Prisma.Decimal(availableBalance);
  return prisma.wallet.create({ data: { userId, currency, availableBalance: balance } });
}

export async function createPayoutDestination(userId: string, accountNumber = "1234 5678 9012") {
  const plain = accountNumber.replace(/[ -]/g, "");
  return prisma.payoutDestination.create({
    data: {
      userId,
      category: "BANK",
      provider: "Bank of Kigali",
      accountHolder: "Aime Test",
      accountNumberEncrypted: encryptPayoutAccountNumber(plain),
      accountNumberLast4: plain.slice(-4),
      isDefault: true,
    },
  });
}

/** Deletes rows in FK-safe order so every test starts from a clean schema. */
export async function cleanupDatabase() {
  await prisma.$transaction([
    prisma.communityMessage.deleteMany(),
    prisma.communityRoom.deleteMany(),
    prisma.withdrawal.deleteMany(),
    prisma.rechargeRequest.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.walletLedger.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.wallet.deleteMany(),
    prisma.payoutDestination.deleteMany(),
    prisma.userSession.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.robotPlan.deleteMany(),
    prisma.robot.deleteMany(),
    prisma.user.deleteMany(),
    prisma.rateLimitBucket.deleteMany(),
    prisma.cronJobRun.deleteMany(),
    prisma.platformSetting.deleteMany(),
  ]);
}

export function fakeFor(user: { id: string; name: string; email: string; role: UserRole; status: UserStatus }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status };
}