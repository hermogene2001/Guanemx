import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, getCurrentUser: vi.fn() };
});

import { GET as getSettings, PATCH as updateSettings } from "@/app/api/admin/settings/route";
import { POST as createRecharge } from "@/app/api/recharges/route";
import { POST as createWithdrawal } from "@/app/api/withdrawals/route";
import { prisma } from "@/lib/prisma";
import { cleanupDatabase, createAgent, createPayoutDestination, createUser, createWallet, fakeFor, makeRequest, requestWithoutOrigin, setCurrentUser } from "./helpers";

describe("platform settings (integration)", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("rejects anonymous and non-admin access", async () => {
    setCurrentUser(null);
    expect((await getSettings()).status).toBe(403);

    const user = await createUser();
    setCurrentUser(fakeFor(user));
    expect((await getSettings()).status).toBe(403);
  });

  it("falls back to defaults, then saves and audits administrator changes", async () => {
    const admin = await createUser({ role: "ADMIN" });
    setCurrentUser(fakeFor(admin));

    const before = await (await getSettings()).json();
    expect(before.settings.withdrawalFeePercent).toBe("10.00");
    expect(before.settings.referralBonusPercent).toBe("0.00");
    expect(before.settings.minimumDepositAmount).toBe("3000.00");
    expect(before.settings.minimumWithdrawalAmount).toBe("1000.00");

    const res = await updateSettings(makeRequest("/api/admin/settings", {
      method: "PATCH",
      body: { usdToRwfRate: 1500, withdrawalFeePercent: 5, referralBonusPercent: 3, minimumDepositAmount: 5000, minimumWithdrawalAmount: 15000 },
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.settings.usdToRwfRate).toBe("1500.0000");
    expect(data.settings.withdrawalFeePercent).toBe("5.00");
    expect(data.settings.referralBonusPercent).toBe("3.00");
    expect(data.settings.minimumDepositAmount).toBe("5000.00");
    expect(data.settings.minimumWithdrawalAmount).toBe("15000.00");

    const stored = await prisma.platformSetting.findUniqueOrThrow({ where: { id: "default" } });
    expect(stored.withdrawalFeePercent.equals(new Prisma.Decimal("5"))).toBe(true);
    expect(stored.minimumDepositAmount.equals(new Prisma.Decimal("5000"))).toBe(true);
    expect(stored.minimumWithdrawalAmount.equals(new Prisma.Decimal("15000"))).toBe(true);
    expect(stored.updatedById).toBe(admin.id);
    await expect(prisma.auditLog.count({ where: { action: "platform.settings_updated" } })).resolves.toBe(1);
  });

  it("rejects an invalid settings payload", async () => {
    const admin = await createUser({ role: "ADMIN" });
    setCurrentUser(fakeFor(admin));
    const res = await updateSettings(makeRequest("/api/admin/settings", {
      method: "PATCH",
      body: { usdToRwfRate: -1, withdrawalFeePercent: 200, referralBonusPercent: 0, minimumDepositAmount: 3000, minimumWithdrawalAmount: 1000 },
    }));
    expect(res.status).toBe(400);
  });

  it("rejects a settings update that fails origin verification", async () => {
    const admin = await createUser({ role: "ADMIN" });
    setCurrentUser(fakeFor(admin));
    const res = await updateSettings(requestWithoutOrigin("/api/admin/settings"));
    expect(res.status).toBe(403);
  });

  it("applies the configured withdrawal fee to new requests", async () => {
    await prisma.platformSetting.upsert({
      where: { id: "default" },
      create: { id: "default", withdrawalFeePercent: 5 },
      update: { withdrawalFeePercent: 5 },
    });
    const user = await createUser();
    await createAgent({ phone: "250788000030" });
    const destination = await createPayoutDestination(user.id);
    await createWallet(user.id, 100000);
    setCurrentUser(fakeFor(user));

    const res = await createWithdrawal(makeRequest("/api/withdrawals", {
      body: { amount: 10000, sourceBalance: "MAIN", payoutDestinationId: destination.id },
      headers: { "idempotency-key": "settings-fee" },
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.fee).toBe("500.00");
    expect(data.netPayout).toBe("9500.00");
  });

  it("enforces the configured minimum deposit on new recharge requests", async () => {
    await prisma.platformSetting.upsert({
      where: { id: "default" },
      create: { id: "default", minimumDepositAmount: 5000 },
      update: { minimumDepositAmount: 5000 },
    });
    const user = await createUser();
    await createAgent({ phone: "250788000031" });
    setCurrentUser(fakeFor(user));

    const belowMinimum = await createRecharge(makeRequest("/api/recharges", {
      body: { amount: 4000 },
      headers: { "idempotency-key": "settings-min-deposit-low" },
    }));
    expect(belowMinimum.status).toBe(400);
    expect((await belowMinimum.json()).error).toContain("5000");

    const atMinimum = await createRecharge(makeRequest("/api/recharges", {
      body: { amount: 5000 },
      headers: { "idempotency-key": "settings-min-deposit-ok" },
    }));
    expect(atMinimum.status).toBe(201);
  });

  it("enforces the configured minimum withdrawal without reserving funds", async () => {
    await prisma.platformSetting.upsert({
      where: { id: "default" },
      create: { id: "default", minimumWithdrawalAmount: 15000 },
      update: { minimumWithdrawalAmount: 15000 },
    });
    const user = await createUser();
    await createAgent({ phone: "250788000032" });
    const destination = await createPayoutDestination(user.id);
    const wallet = await createWallet(user.id, 100000);
    setCurrentUser(fakeFor(user));

    const response = await createWithdrawal(makeRequest("/api/withdrawals", {
      body: { amount: 10000, sourceBalance: "MAIN", payoutDestinationId: destination.id },
      headers: { "idempotency-key": "settings-min-withdrawal-low" },
    }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("15000");
    await expect(prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } })).resolves.toMatchObject({
      availableBalance: new Prisma.Decimal("100000"),
    });
    await expect(prisma.withdrawal.count()).resolves.toBe(0);
  });
});
