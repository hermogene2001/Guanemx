import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, getCurrentUser: vi.fn() };
});

import { GET as listWithdrawals, POST as createWithdrawal } from "@/app/api/withdrawals/route";
import { POST as reviewWithdrawal } from "@/app/api/agent/withdrawals/[id]/review/route";
import { prisma } from "@/lib/prisma";
import { cleanupDatabase, createAgent, createPayoutDestination, createUser, createWallet, fakeFor, makeRequest, requestWithoutOrigin, reviewParams, setCurrentUser } from "./helpers";

let keyCounter = 0;

function withdrawInit(destinationId: string, key?: string) {
  return {
    body: validBody(destinationId),
    headers: { "idempotency-key": key ?? `w-it-${++keyCounter}` },
  };
}

describe("withdrawal wallet flow (integration)", () => {
  beforeEach(async () => {
    await cleanupDatabase();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires an authenticated user", async () => {
    setCurrentUser(null);
    const res = await createWithdrawal(makeRequest("/api/withdrawals", { body: validBody("some-id") }));
    expect(res.status).toBe(401);
  });

  it("rejects a request that fails origin verification", async () => {
    const user = await createUser();
    setCurrentUser(fakeFor(user));
    const res = await createWithdrawal(requestWithoutOrigin("/api/withdrawals"));
    expect(res.status).toBe(403);
  });

  it("returns 503 when no active review agent is configured", async () => {
    const user = await createUser();
    const destination = await createPayoutDestination(user.id);
    await createWallet(user.id, 100000);
    setCurrentUser(fakeFor(user));
    const res = await createWithdrawal(makeRequest("/api/withdrawals", withdrawInit(destination.id)));
    expect(res.status).toBe(503);
  });

  it("rejects a payout destination owned by another user", async () => {
    const user = await createUser();
    const other = await createUser();
    await createAgent();
    const foreignDestination = await createPayoutDestination(other.id);
    await createWallet(user.id, 100000);
    setCurrentUser(fakeFor(user));
    const res = await createWithdrawal(makeRequest("/api/withdrawals", withdrawInit(foreignDestination.id)));
    expect(res.status).toBe(400);
  });

  it("reserves the gross amount and records fee/net payout on request", async () => {
    const user = await createUser();
    const agent = await createAgent({ phone: "250788000020" });
    const destination = await createPayoutDestination(user.id);
    const wallet = await createWallet(user.id, 100000);
    setCurrentUser(fakeFor(user));

    const res = await createWithdrawal(makeRequest("/api/withdrawals", withdrawInit(destination.id)));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.repeated).toBe(false);
    expect(data.status).toBe("PENDING");
    expect(data.amount).toBe("10000");
    expect(data.fee).toBe("1000.00");
    expect(data.netPayout).toBe("9000.00");

    const afterWallet = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    expect(afterWallet.availableBalance.equals(new Prisma.Decimal("90000"))).toBe(true);

    const withdrawal = await prisma.withdrawal.findUniqueOrThrow({ where: { id: data.id } });
    expect(withdrawal.status).toBe("PENDING");
    expect(withdrawal.fee.equals(new Prisma.Decimal("1000"))).toBe(true);
    expect(withdrawal.netPayout.equals(new Prisma.Decimal("9000"))).toBe(true);
    expect(withdrawal.assignedAgentId).toBe(agent.id);
    expect(withdrawal.payoutDestinationId).toBe(destination.id);

    const tx = await prisma.transaction.findUniqueOrThrow({ where: { id: withdrawal.transactionId } });
    expect(tx.type).toBe("WITHDRAWAL");
    expect(tx.status).toBe("PENDING");
    expect(tx.amount.equals(new Prisma.Decimal("10000"))).toBe(true);

    const ledger = await prisma.walletLedger.findFirstOrThrow({ where: { transactionId: tx.id } });
    expect(ledger.balanceBefore.equals(new Prisma.Decimal("100000"))).toBe(true);
    expect(ledger.balanceAfter.equals(new Prisma.Decimal("90000"))).toBe(true);
    expect(ledger.amount.toString()).toBe("-10000");

    await expect(prisma.auditLog.count({ where: { action: "withdrawal.requested" } })).resolves.toBe(1);
  });

  it("replays the same withdrawal for a repeated idempotency key", async () => {
    const user = await createUser();
    await createAgent({ phone: "250788000021" });
    const destination = await createPayoutDestination(user.id);
    const wallet = await createWallet(user.id, 100000);
    setCurrentUser(fakeFor(user));

    const key = "w-replay-fixed";
    const first = await createWithdrawal(makeRequest("/api/withdrawals", withdrawInit(destination.id, key)));
    const second = await createWithdrawal(makeRequest("/api/withdrawals", withdrawInit(destination.id, key)));
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(secondBody.repeated).toBe(true);
    expect(secondBody.id).toBe(firstBody.id);

    const afterWallet = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    expect(afterWallet.availableBalance.equals(new Prisma.Decimal("90000"))).toBe(true);
    await expect(prisma.withdrawal.count()).resolves.toBe(1);
  });

  it("rejects withdrawal when the selected balance is insufficient", async () => {
    const user = await createUser();
    await createAgent({ phone: "250788000022" });
    const destination = await createPayoutDestination(user.id);
    const wallet = await createWallet(user.id, 5000);
    setCurrentUser(fakeFor(user));

    const res = await createWithdrawal(makeRequest("/api/withdrawals", withdrawInit(destination.id)));
    expect(res.status).toBe(409);

    const afterWallet = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    expect(afterWallet.availableBalance.equals(new Prisma.Decimal("5000"))).toBe(true);
  });

  it("enforces one withdrawal request per Friday", async () => {
    const user = await createUser();
    await createAgent({ phone: "250788000023" });
    const destination = await createPayoutDestination(user.id);
    await createWallet(user.id, 100000);
    setCurrentUser(fakeFor(user));

    const first = await createWithdrawal(makeRequest("/api/withdrawals", withdrawInit(destination.id)));
    expect(first.status).toBe(201);
    const created = await first.json();
    await prisma.transaction.update({
      where: { id: (await prisma.withdrawal.findUniqueOrThrow({ where: { id: created.id } })).transactionId },
      data: { createdAt: new Date("2026-10-09T12:00:00.000Z") },
    });

    const second = await createWithdrawal(makeRequest("/api/withdrawals", withdrawInit(destination.id, "w-day-2")));
    expect(second.status).toBe(409);
    expect((await second.json()).error).toContain("one withdrawal request per Friday");
  });

  it("closes withdrawal requests outside Friday in Kigali time", async () => {
    const user = await createUser();
    await createAgent({ phone: "250788000025" });
    const destination = await createPayoutDestination(user.id);
    const wallet = await createWallet(user.id, 100000);
    setCurrentUser(fakeFor(user));
    vi.setSystemTime(new Date("2026-10-10T12:00:00.000Z"));

    const response = await createWithdrawal(makeRequest("/api/withdrawals", withdrawInit(destination.id)));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("Fridays only");
    await expect(prisma.withdrawal.count()).resolves.toBe(0);
    const afterWallet = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    expect(afterWallet.availableBalance.equals(new Prisma.Decimal("100000"))).toBe(true);
  });

  it("approves a withdrawal and records the payout + fee transactions", async () => {
    const user = await createUser();
    const agent = await createAgent({ phone: "250788000024" });
    const destination = await createPayoutDestination(user.id);
    await createWallet(user.id, 100000);
    setCurrentUser(fakeFor(user));

    const created = await createWithdrawal(makeRequest("/api/withdrawals", withdrawInit(destination.id)));
    expect(created.status).toBe(201);
    const { id } = await created.json();

    setCurrentUser(fakeFor(agent));
    const res = await reviewWithdrawal(makeRequest(`/api/agent/withdrawals/${id}/review`, { body: { action: "approve" } }), reviewParams(id));
    expect(res.status).toBe(200);
    const outcome = await res.json();
    expect(outcome.status).toBe("APPROVED");
    expect(outcome.netPayout).toBe("9000.00");
    expect(outcome.fee).toBe("1000.00");
    expect(outcome.manualPayoutRequired).toBe(true);

    const withdrawal = await prisma.withdrawal.findUniqueOrThrow({ where: { id } });
    expect(withdrawal.status).toBe("APPROVED");
    expect(withdrawal.reviewedById).toBe(agent.id);

    const gross = await prisma.transaction.findUniqueOrThrow({ where: { id: withdrawal.transactionId } });
    expect(gross.status).toBe("COMPLETED");

    const payout = await prisma.transaction.findFirstOrThrow({ where: { userId: user.id, type: "WITHDRAWAL", status: "PROCESSING" } });
    expect(payout.amount.equals(new Prisma.Decimal("9000"))).toBe(true);
    expect(payout.reference.startsWith("PAY-")).toBe(true);

    const fee = await prisma.transaction.findFirstOrThrow({ where: { userId: user.id, type: "FEE" } });
    expect(fee.amount.equals(new Prisma.Decimal("1000"))).toBe(true);
    expect(fee.reference.startsWith("FEE-")).toBe(true);
  });

  it("rejects a second review of an approved withdrawal", async () => {
    const user = await createUser();
    const agent = await createAgent({ phone: "250788000025" });
    const destination = await createPayoutDestination(user.id);
    await createWallet(user.id, 100000);
    setCurrentUser(fakeFor(user));
    const created = await createWithdrawal(makeRequest("/api/withdrawals", withdrawInit(destination.id)));
    const { id } = await created.json();

    setCurrentUser(fakeFor(agent));
    await reviewWithdrawal(makeRequest(`/api/agent/withdrawals/${id}/review`, { body: { action: "approve" } }), reviewParams(id));
    const res = await reviewWithdrawal(makeRequest(`/api/agent/withdrawals/${id}/review`, { body: { action: "approve" } }), reviewParams(id));
    expect(res.status).toBe(409);
  });

  it("forbids an agent who is not assigned from reviewing", async () => {
    const user = await createUser();
    const agent = await createAgent({ phone: "250788000026" });
    const destination = await createPayoutDestination(user.id);
    await createWallet(user.id, 100000);
    setCurrentUser(fakeFor(user));
    const created = await createWithdrawal(makeRequest("/api/withdrawals", withdrawInit(destination.id)));
    expect(created.status).toBe(201);
    const { id } = await created.json();

    const otherAgent = await createAgent({ phone: "250788000027" });
    setCurrentUser(fakeFor(otherAgent));
    const res = await reviewWithdrawal(makeRequest(`/api/agent/withdrawals/${id}/review`, { body: { action: "approve" } }), reviewParams(id));
    expect(res.status).toBe(404);

    const withdrawal = await prisma.withdrawal.findUniqueOrThrow({ where: { id } });
    expect(withdrawal.status).toBe("PENDING");
    expect(withdrawal.assignedAgentId).toBe(agent.id);
  });

  it("refunds the reserved gross amount when a withdrawal is rejected", async () => {
    const user = await createUser();
    const agent = await createAgent({ phone: "250788000028" });
    const destination = await createPayoutDestination(user.id);
    const wallet = await createWallet(user.id, 100000);
    setCurrentUser(fakeFor(user));
    const created = await createWithdrawal(makeRequest("/api/withdrawals", withdrawInit(destination.id)));
    expect(created.status).toBe(201);
    const { id } = await created.json();

    setCurrentUser(fakeFor(agent));
    const res = await reviewWithdrawal(
      makeRequest(`/api/agent/withdrawals/${id}/review`, { body: { action: "reject", reason: "Destination mismatch" } }),
      reviewParams(id),
    );
    expect(res.status).toBe(200);
    const outcome = await res.json();
    expect(outcome.status).toBe("REJECTED");
    expect(outcome.returnedAmount).toBe("10000.00");

    const afterWallet = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    expect(afterWallet.availableBalance.equals(new Prisma.Decimal("100000"))).toBe(true);

    const withdrawal = await prisma.withdrawal.findUniqueOrThrow({ where: { id } });
    expect(withdrawal.status).toBe("REJECTED");
    expect(withdrawal.reviewReason).toBe("Destination mismatch");

    const gross = await prisma.transaction.findUniqueOrThrow({ where: { id: withdrawal.transactionId } });
    expect(gross.status).toBe("REJECTED");

    const refund = await prisma.transaction.findFirstOrThrow({ where: { userId: user.id, type: "REFUND" } });
    expect(refund.status).toBe("COMPLETED");
    expect(refund.amount.equals(new Prisma.Decimal("10000"))).toBe(true);
    const ledger = await prisma.walletLedger.findFirstOrThrow({ where: { transactionId: refund.id } });
    expect(ledger.balanceBefore.equals(new Prisma.Decimal("90000"))).toBe(true);
    expect(ledger.balanceAfter.equals(new Prisma.Decimal("100000"))).toBe(true);
  });

  it("lists the user's withdrawals with their destination", async () => {
    setCurrentUser(null);
    const unauthorized = await listWithdrawals();
    expect(unauthorized.status).toBe(401);

    const user = await createUser();
    await createAgent({ phone: "250788000029" });
    const destination = await createPayoutDestination(user.id);
    await createWallet(user.id, 100000);
    setCurrentUser(fakeFor(user));
    await createWithdrawal(makeRequest("/api/withdrawals", withdrawInit(destination.id)));

    const res = await listWithdrawals();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.withdrawals).toHaveLength(1);
    expect(data.withdrawals[0].amount).toBe("10000");
    expect(data.withdrawals[0].fee).toBe("1000.00");
    expect(data.withdrawals[0].sourceBalance).toBe("MAIN");
    expect(data.withdrawals[0].destination.accountNumberLast4).toBe("9012");
  });
});

function validBody(destinationId: string) {
  return { amount: 10000, sourceBalance: "MAIN", payoutDestinationId: destinationId };
}