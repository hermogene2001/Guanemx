import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, getCurrentUser: vi.fn() };
});

import { GET as getSettings, PATCH as updateSettings } from "@/app/api/admin/settings/route";
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

    const res = await updateSettings(makeRequest("/api/admin/settings", {
      method: "PATCH",
      body: { usdToRwfRate: 1500, withdrawalFeePercent: 5, referralBonusPercent: 3 },
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.settings.usdToRwfRate).toBe("1500.0000");
    expect(data.settings.withdrawalFeePercent).toBe("5.00");
    expect(data.settings.referralBonusPercent).toBe("3.00");

    const stored = await prisma.platformSetting.findUniqueOrThrow({ where: { id: "default" } });
    expect(stored.withdrawalFeePercent.equals(new Prisma.Decimal("5"))).toBe(true);
    expect(stored.updatedById).toBe(admin.id);
    await expect(prisma.auditLog.count({ where: { action: "platform.settings_updated" } })).resolves.toBe(1);
  });

  it("rejects an invalid settings payload", async () => {
    const admin = await createUser({ role: "ADMIN" });
    setCurrentUser(fakeFor(admin));
    const res = await updateSettings(makeRequest("/api/admin/settings", {
      method: "PATCH",
      body: { usdToRwfRate: -1, withdrawalFeePercent: 200, referralBonusPercent: 0 },
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
});
