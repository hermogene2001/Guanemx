import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, getCurrentUser: vi.fn() };
});

import { GET as listRecharges, POST as createRecharge } from "@/app/api/recharges/route";
import { POST as reviewRecharge } from "@/app/api/agent/recharges/[id]/review/route";
import { prisma } from "@/lib/prisma";
import { cleanupDatabase, createAgent, createUser, fakeFor, makeRequest, requestWithoutOrigin, reviewParams, setCurrentUser } from "./helpers";

const WALLET_AMOUNT = new Prisma.Decimal("50000");

describe("recharge wallet flow (integration)", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(() => {
    delete process.env.REFERRAL_RECHARGE_BONUS_PERCENT;
  });

  it("rejects a request that fails origin verification", async () => {
    const user = await createUser();
    setCurrentUser(fakeFor(user));
    const res = await createRecharge(requestWithoutOrigin("/api/recharges"));
    expect(res.status).toBe(403);
  });

  it("requires an authenticated user", async () => {
    setCurrentUser(null);
    const res = await createRecharge(makeRequest("/api/recharges", { body: { amount: 50000 }, headers: { "idempotency-key": "r-noauth" } }));
    expect(res.status).toBe(401);
  });

  it("requires an idempotency key", async () => {
    const user = await createUser();
    setCurrentUser(fakeFor(user));
    await createAgent();
    const res = await createRecharge(makeRequest("/api/recharges", { body: { amount: 50000 } }));
    expect(res.status).toBe(400);
  });

  it("rejects an out-of-range amount", async () => {
    const user = await createUser();
    setCurrentUser(fakeFor(user));
    await createAgent();
    const res = await createRecharge(makeRequest("/api/recharges", { body: { amount: 100 }, headers: { "idempotency-key": "r-bad-amount" } }));
    expect(res.status).toBe(400);
  });

  it("returns 503 when no active payment agent with a phone is configured", async () => {
    const user = await createUser();
    setCurrentUser(fakeFor(user));
    const res = await createRecharge(makeRequest("/api/recharges", { body: { amount: 50000 }, headers: { "idempotency-key": "r-no-agent" } }));
    expect(res.status).toBe(503);
  });

  it("creates a pending recharge request assigned to an active agent without touching balances", async () => {
    const user = await createUser();
    const agent = await createAgent();
    setCurrentUser(fakeFor(user));

    const res = await createRecharge(makeRequest("/api/recharges", { body: { amount: 50000 }, headers: { "idempotency-key": "r-ok-1" } }));
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.status).toBe("PENDING");
    expect(data.amount).toBe("50000");
    expect(data.agent.name).toBe(agent.name);
    expect(data.agent.phone).toBe(agent.phone);

    const recharge = await prisma.rechargeRequest.findUniqueOrThrow({ where: { id: data.id } });
    expect(recharge.assignedAgentId).toBe(agent.id);
    expect(recharge.amount.equals(WALLET_AMOUNT)).toBe(true);

    await expect(prisma.transaction.count()).resolves.toBe(0);
    await expect(prisma.wallet.count()).resolves.toBe(0);
    const audit = await prisma.auditLog.findFirst({ where: { action: "recharge.requested" } });
    expect(audit?.entityId).toBe(data.id);
  });

  it("returns the same request for a repeated idempotency key without duplicating rows", async () => {
    const user = await createUser();
    await createAgent();
    setCurrentUser(fakeFor(user));

    const first = await createRecharge(makeRequest("/api/recharges", { body: { amount: 50000 }, headers: { "idempotency-key": "r-repeat" } }));
    const second = await createRecharge(makeRequest("/api/recharges", { body: { amount: 50000 }, headers: { "idempotency-key": "r-repeat" } }));

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(secondBody.id).toBe(firstBody.id);
    await expect(prisma.rechargeRequest.count()).resolves.toBe(1);
  });

  it("credits the wallet when an agent confirms the recharge", async () => {
    const user = await createUser();
    const agent = await createAgent();
    setCurrentUser(fakeFor(user));

    const created = await createRecharge(makeRequest("/api/recharges", { body: { amount: 50000 }, headers: { "idempotency-key": "r-confirm" } }));
    const { id } = await created.json();

    setCurrentUser(fakeFor(agent));
    const res = await reviewRecharge(makeRequest(`/api/agent/recharges/${id}/review`, { body: { action: "confirm" } }), reviewParams(id));
    expect(res.status).toBe(200);
    const outcome = await res.json();
    expect(outcome.status).toBe("CONFIRMED");
    expect(outcome.creditedAmount).toBe("50000.00");
    expect(outcome.referralBonus).toBe("0.00");

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.availableBalance.equals(WALLET_AMOUNT)).toBe(true);

    const deposit = await prisma.transaction.findFirstOrThrow({ where: { userId: user.id, type: "DEPOSIT" } });
    expect(deposit.status).toBe("COMPLETED");
    expect(deposit.amount.equals(WALLET_AMOUNT)).toBe(true);

    const ledger = await prisma.walletLedger.findFirstOrThrow({ where: { transactionId: deposit.id } });
    expect(ledger.balanceBefore.equals(new Prisma.Decimal(0))).toBe(true);
    expect(ledger.balanceAfter.equals(WALLET_AMOUNT)).toBe(true);

    const recharge = await prisma.rechargeRequest.findUniqueOrThrow({ where: { id } });
    expect(recharge.status).toBe("CONFIRMED");
    expect(recharge.transactionId).toBe(deposit.id);
    await expect(prisma.auditLog.count({ where: { action: "recharge.confirmed" } })).resolves.toBe(1);
  });

  it("rejects a second review of the same recharge and does not double-credit", async () => {
    const user = await createUser();
    const agent = await createAgent();
    setCurrentUser(fakeFor(user));
    const created = await createRecharge(makeRequest("/api/recharges", { body: { amount: 50000 }, headers: { "idempotency-key": "r-confirm-2" } }));
    const { id } = await created.json();

    setCurrentUser(fakeFor(agent));
    await reviewRecharge(makeRequest(`/api/agent/recharges/${id}/review`, { body: { action: "confirm" } }), reviewParams(id));
    const res = await reviewRecharge(makeRequest(`/api/agent/recharges/${id}/review`, { body: { action: "confirm" } }), reviewParams(id));

    expect(res.status).toBe(409);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.availableBalance.equals(WALLET_AMOUNT)).toBe(true);
    await expect(prisma.transaction.count({ where: { type: "DEPOSIT" } })).resolves.toBe(1);
  });

  it("forbids an agent who is not assigned from reviewing", async () => {
    const user = await createUser();
    const agent = await createAgent();
    setCurrentUser(fakeFor(user));
    const created = await createRecharge(makeRequest("/api/recharges", { body: { amount: 50000 }, headers: { "idempotency-key": "r-wrong-agent" } }));
    const { id } = await created.json();
    expect(created.status).toBe(201);

    // The reviewer is created after the request, so it cannot be the assigned agent.
    const otherAgent = await createAgent({ phone: "250788000002" });
    setCurrentUser(fakeFor(otherAgent));
    const res = await reviewRecharge(makeRequest(`/api/agent/recharges/${id}/review`, { body: { action: "confirm" } }), reviewParams(id));
    expect(res.status).toBe(404);

    await expect(prisma.transaction.count()).resolves.toBe(0);
    const recharge = await prisma.rechargeRequest.findUniqueOrThrow({ where: { id } });
    expect(recharge.status).toBe("PENDING");
    expect(recharge.assignedAgentId).toBe(agent.id);
  });

  it("rejects a recharge without crediting the wallet", async () => {
    const user = await createUser();
    const agent = await createAgent();
    setCurrentUser(fakeFor(user));
    const created = await createRecharge(makeRequest("/api/recharges", { body: { amount: 50000 }, headers: { "idempotency-key": "r-reject" } }));
    const { id } = await created.json();

    setCurrentUser(fakeFor(agent));
    const res = await reviewRecharge(
      makeRequest(`/api/agent/recharges/${id}/review`, { body: { action: "reject", reason: "Unable to verify payment" } }),
      reviewParams(id),
    );
    expect(res.status).toBe(200);

    const recharge = await prisma.rechargeRequest.findUniqueOrThrow({ where: { id } });
    expect(recharge.status).toBe("REJECTED");
    expect(recharge.reviewReason).toBe("Unable to verify payment");
    await expect(prisma.wallet.count()).resolves.toBe(0);
    await expect(prisma.transaction.count()).resolves.toBe(0);
  });

  it("pays the configured referral bonus to the inviter on confirmation", async () => {
    process.env.REFERRAL_RECHARGE_BONUS_PERCENT = "10";
    const inviter = await createUser();
    const user = await createUser({ invitedById: inviter.id });
    const agent = await createAgent();
    setCurrentUser(fakeFor(user));
    const created = await createRecharge(makeRequest("/api/recharges", { body: { amount: 50000 }, headers: { "idempotency-key": "r-referral" } }));
    const { id } = await created.json();

    setCurrentUser(fakeFor(agent));
    const res = await reviewRecharge(makeRequest(`/api/agent/recharges/${id}/review`, { body: { action: "confirm" } }), reviewParams(id));
    expect(res.status).toBe(200);
    const outcome = await res.json();
    expect(outcome.referralBonus).toBe("5000.00");

    const inviterWallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: inviter.id } });
    expect(inviterWallet.availableBalance.equals(new Prisma.Decimal("5000"))).toBe(true);
    const bonus = await prisma.transaction.findFirstOrThrow({ where: { userId: inviter.id, type: "REFERRAL_BONUS" } });
    expect(bonus.amount.equals(new Prisma.Decimal("5000"))).toBe(true);
  });

  it("lists the user's recharge requests", async () => {
    setCurrentUser(null);
    const unauthorized = await listRecharges();
    expect(unauthorized.status).toBe(401);

    const user = await createUser();
    await createAgent();
    setCurrentUser(fakeFor(user));
    await createRecharge(makeRequest("/api/recharges", { body: { amount: 50000 }, headers: { "idempotency-key": "r-list" } }));

    const res = await listRecharges();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.recharges).toHaveLength(1);
    expect(data.recharges[0].amount).toBe("50000");
    expect(data.recharges[0].reference).toBeNull();
  });
});