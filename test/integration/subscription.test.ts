import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { CURRENCY } from "@/lib/money";

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, getCurrentUser: vi.fn() };
});

import { POST as subscribe } from "@/app/api/subscriptions/route";
import { POST as runMaintenance } from "@/app/api/cron/subscriptions/route";
import { prisma } from "@/lib/prisma";
import { cleanupDatabase, createUser, createWallet, fakeFor, makeRequest, setCurrentUser } from "./helpers";

const CRON_SECRET = "integration-cron-secret-at-least-32-characters";
const PRICE = new Prisma.Decimal("15000");

describe("robot subscription checkout (integration)", () => {
  beforeEach(async () => {
    await cleanupDatabase();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  it("requires an authenticated and active user", async () => {
    setCurrentUser(null);
    const anonymous = await subscribe(makeRequest("/api/subscriptions", { body: validBody() }));
    expect(anonymous.status).toBe(401);

    const pending = await createUser({ status: "PENDING_VERIFICATION" });
    setCurrentUser(fakeFor(pending));
    const unverified = await subscribe(makeRequest("/api/subscriptions", { body: validBody() }));
    expect(unverified.status).toBe(403);
  });

  it("validates the checkout body", async () => {
    const user = await createUser();
    setCurrentUser(fakeFor(user));
    const res = await subscribe(makeRequest("/api/subscriptions", { body: { planId: "plan-1" } }));
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unavailable or unknown plan", async () => {
    const user = await createUser();
    setCurrentUser(fakeFor(user));
    const res = await subscribe(makeRequest("/api/subscriptions", { body: validBody("no-such-plan") }));
    expect(res.status).toBe(404);
  });

  it("returns 409 when the Main Balance does not cover the plan", async () => {
    const { user, plan } = await seedRobotPlan();
    await createWallet(user.id, 10000, CURRENCY);
    setCurrentUser(fakeFor(user));

    const res = await subscribe(makeRequest("/api/subscriptions", { body: validBody(plan.id) }));
    expect(res.status).toBe(409);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.availableBalance.equals(new Prisma.Decimal("10000"))).toBe(true);
    await expect(prisma.subscription.count()).resolves.toBe(0);
    await expect(prisma.transaction.count()).resolves.toBe(0);
  });

  it("charges the wallet and creates an active subscription", async () => {
    const { user, robot, plan } = await seedRobotPlan();
    const wallet = await createWallet(user.id, 100000, CURRENCY);
    setCurrentUser(fakeFor(user));

    const res = await subscribe(makeRequest("/api/subscriptions", { body: validBody(plan.id) }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.replayed).toBe(false);
    expect(data.subscription.status).toBe("ACTIVE");
    expect(data.subscription.robot).toBe(robot.name);
    expect(data.subscription.plan).toBe(plan.name);
    expect(data.subscription.price).toBe("15000.00");
    expect(data.subscription.currency).toBe(CURRENCY);

    const afterWallet = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    expect(afterWallet.availableBalance.equals(new Prisma.Decimal("85000"))).toBe(true);

    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { id: data.subscription.id } });
    expect(subscription.robotId).toBe(robot.id);
    expect(subscription.robotPlanId).toBe(plan.id);
    expect(subscription.status).toBe("ACTIVE");
    expect(subscription.dailyReturnPercentage.equals(new Prisma.Decimal("2.50"))).toBe(true);
    expect(subscription.expiresAt!.getTime() - subscription.startAt!.getTime()).toBe(30 * 24 * 60 * 60 * 1000);

    const tx = await prisma.transaction.findUniqueOrThrow({ where: { idempotencyKey: "00000000-0000-4000-8000-000000000001" } });
    expect(tx.type).toBe("SUBSCRIPTION");
    expect(tx.status).toBe("COMPLETED");
    expect(tx.amount.equals(PRICE)).toBe(true);
    expect(tx.reference.startsWith("SUB-")).toBe(true);

    const ledger = await prisma.walletLedger.findFirstOrThrow({ where: { transactionId: tx.id } });
    expect(ledger.balanceBefore.equals(new Prisma.Decimal("100000"))).toBe(true);
    expect(ledger.balanceAfter.equals(new Prisma.Decimal("85000"))).toBe(true);
    expect(ledger.amount.toString()).toBe("-15000");

    await expect(prisma.auditLog.count({ where: { action: "subscription.purchased" } })).resolves.toBe(1);
  });

  it("replays the same checkout key without charging twice", async () => {
    const { user, plan } = await seedRobotPlan();
    const wallet = await createWallet(user.id, 100000, CURRENCY);
    setCurrentUser(fakeFor(user));

    const first = await subscribe(makeRequest("/api/subscriptions", { body: validBody(plan.id) }));
    const second = await subscribe(makeRequest("/api/subscriptions", { body: validBody(plan.id) }));
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);

    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(secondBody.replayed).toBe(true);
    expect(secondBody.subscription.id).toBe(firstBody.subscription.id);

    const afterWallet = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    expect(afterWallet.availableBalance.equals(new Prisma.Decimal("85000"))).toBe(true);
    await expect(prisma.subscription.count()).resolves.toBe(1);
    await expect(prisma.transaction.count()).resolves.toBe(1);
  });

  it("rejects a checkout key already used by another user", async () => {
    const { user, plan } = await seedRobotPlan();
    const other = await createUser();
    await createWallet(user.id, 100000, CURRENCY);
    await createWallet(other.id, 100000, CURRENCY);
    setCurrentUser(fakeFor(user));
    await subscribe(makeRequest("/api/subscriptions", { body: validBody(plan.id) }));

    setCurrentUser(fakeFor(other));
    const res = await subscribe(makeRequest("/api/subscriptions", { body: validBody(plan.id) }));
    expect(res.status).toBe(409);
    const otherWallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: other.id } });
    expect(otherWallet.availableBalance.equals(new Prisma.Decimal("100000"))).toBe(true);
  });

  it("maintenance requires the cron bearer token", async () => {
    const res = await runMaintenance(makeRequest("/api/cron/subscriptions", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("expires due subscriptions and prunes expired tokens and sessions", async () => {
    const { user, plan } = await seedRobotPlan();
    const due = await prisma.subscription.create({
      data: { userId: user.id, robotId: plan.robotId, robotPlanId: plan.id, status: "ACTIVE", price: PRICE, currency: CURRENCY, startAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), expiresAt: new Date(Date.now() - 1000) },
    });
    const notDue = await prisma.subscription.create({
      data: { userId: user.id, robotId: plan.robotId, robotPlanId: plan.id, status: "ACTIVE", price: PRICE, currency: CURRENCY, startAt: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });
    await prisma.verificationToken.create({
      data: { userId: user.id, purpose: "verify-email", tokenHash: "stale-token-hash-1", expiresAt: new Date(Date.now() - 1000) },
    });
    await prisma.userSession.create({
      data: { userId: user.id, tokenHash: "stale-session-hash-1", expiresAt: new Date(Date.now() - 1000) },
    });

    const request = makeRequest("/api/cron/subscriptions", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    const res = await runMaintenance(request);
    expect(res.status).toBe(200);
    const outcome = await res.json();
    expect(outcome.expiredSubscriptions).toBe(1);
    expect(outcome.removedExpiredVerificationTokens).toBe(1);
    expect(outcome.removedExpiredSessions).toBe(1);

    await expect(prisma.subscription.findUniqueOrThrow({ where: { id: due.id } })).resolves.toMatchObject({ status: "EXPIRED" });
    await expect(prisma.subscription.findUniqueOrThrow({ where: { id: notDue.id } })).resolves.toMatchObject({ status: "ACTIVE" });
  });
});

function validBody(planId = "some-plan-id") {
  return { planId, idempotencyKey: "00000000-0000-4000-8000-000000000001" };
}

async function seedRobotPlan() {
  const robot = await prisma.robot.create({
    data: {
      name: "Steady Alpha",
      slug: "steady-alpha",
      description: "Integration-test robot, no trading data.",
      strategyDescription: "Integration-test strategy description.",
      market: "BTC/USD",
      riskLevel: "MEDIUM",
      robotType: "TEST",
      status: "ACTIVE",
      tier: "PRO",
    },
  });
  const plan = await prisma.robotPlan.create({
    data: { robotId: robot.id, name: "Pro 30d", durationDays: 30, price: PRICE, currency: CURRENCY, dailyReturnPercentage: "2.50", status: "ACTIVE" },
  });
  const user = await createUser();
  return { user, robot, plan };
}