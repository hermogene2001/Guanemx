import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, getCurrentUser: vi.fn() };
});

import { GET as listUserRobots } from "@/app/api/users/robots/route";
import { PATCH as updateRobot } from "@/app/api/admin/robots/[id]/route";
import { prisma } from "@/lib/prisma";
import { runRobotEarnings } from "@/lib/robot-earnings";
import { CURRENCY } from "@/lib/money";
import { cleanupDatabase, createUser, createWallet, fakeFor, makeRequest, setCurrentUser } from "./helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("robot daily earnings (integration)", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("catches up due days atomically, is idempotent, and expires after the final credit", async () => {
    const { user, robot, plan } = await seedPlan(3);
    const wallet = await createWallet(user.id, 50);
    const now = new Date("2026-10-20T12:00:00.000Z");
    const startAt = new Date(now.getTime() - (2 * DAY_MS + 1000));
    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        robotId: robot.id,
        robotPlanId: plan.id,
        status: "ACTIVE",
        price: "1000.00",
        currency: CURRENCY,
        dailyReturnPercentage: "2.50",
        startAt,
        expiresAt: new Date(startAt.getTime() + 3 * DAY_MS),
      },
    });

    const caughtUp = await runRobotEarnings(now);
    expect(caughtUp).toMatchObject({ status: "COMPLETED", processedCount: 2, failedCount: 0 });
    await expect(prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } })).resolves.toMatchObject({
      availableBalance: new Prisma.Decimal("100.00"),
    });
    await expect(prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } })).resolves.toMatchObject({
      daysCompleted: 2,
      status: "ACTIVE",
    });
    const credits = await prisma.transaction.findMany({
      where: { subscriptionId: subscription.id, type: "ROBOT_EARNING" },
      include: { ledgerEntries: true },
      orderBy: { createdAt: "asc" },
    });
    expect(credits).toHaveLength(2);
    expect(credits.map((credit) => credit.idempotencyKey)).toEqual([
      `robot-earning:${subscription.id}:1`,
      `robot-earning:${subscription.id}:2`,
    ]);
    expect(credits.every((credit) => credit.ledgerEntries.length === 1)).toBe(true);
    setCurrentUser(fakeFor(user));
    const listed = await listUserRobots();
    expect(listed.status).toBe(200);
    expect((await listed.json()).robots).toMatchObject([{
      subscriptionId: subscription.id,
      daysCompleted: 2,
      daysRemaining: 1,
      totalEarned: "50.00",
    }]);

    const replay = await runRobotEarnings(now);
    expect(replay).toMatchObject({ status: "COMPLETED", processedCount: 0, failedCount: 0 });
    await expect(prisma.transaction.count({ where: { subscriptionId: subscription.id, type: "ROBOT_EARNING" } })).resolves.toBe(2);
    await expect(prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } })).resolves.toMatchObject({
      availableBalance: new Prisma.Decimal("100.00"),
    });

    const completed = await runRobotEarnings(new Date(now.getTime() + DAY_MS));
    expect(completed).toMatchObject({ status: "COMPLETED", processedCount: 1, failedCount: 0 });
    await expect(prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } })).resolves.toMatchObject({
      daysCompleted: 3,
      status: "EXPIRED",
    });
    await expect(prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } })).resolves.toMatchObject({
      availableBalance: new Prisma.Decimal("125.00"),
    });
  });

  it("does not credit a paused robot and reports earned total only to its owner", async () => {
    const { user, robot, plan } = await seedPlan(5);
    const wallet = await createWallet(user.id, 0);
    const startAt = new Date(Date.now() - 2 * DAY_MS);
    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        robotId: robot.id,
        robotPlanId: plan.id,
        status: "ACTIVE",
        price: "1000.00",
        currency: CURRENCY,
        dailyReturnPercentage: "2.50",
        startAt,
        expiresAt: new Date(startAt.getTime() + 5 * DAY_MS),
      },
    });
    await prisma.robot.update({ where: { id: robot.id }, data: { status: "PAUSED" } });
    expect((await runRobotEarnings()).processedCount).toBe(0);
    await expect(prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } })).resolves.toMatchObject({
      availableBalance: new Prisma.Decimal("0"),
    });

    setCurrentUser(fakeFor(user));
    const response = await listUserRobots();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.robots).toMatchObject([{
      subscriptionId: subscription.id,
      status: "PAUSED",
      daysCompleted: 0,
      daysRemaining: 5,
      totalEarned: "0.00",
      dailyReturnPercentage: "2.50",
    }]);

    setCurrentUser(null);
    expect((await listUserRobots()).status).toBe(401);
  });

  it("lets administrators change a plan rate without changing existing subscription rates", async () => {
    const { robot, plan, user } = await seedPlan(5);
    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        robotId: robot.id,
        robotPlanId: plan.id,
        status: "ACTIVE",
        price: plan.price,
        currency: plan.currency,
        dailyReturnPercentage: "2.50",
        startAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * DAY_MS),
      },
    });
    const admin = await createUser({ role: "ADMIN" });
    setCurrentUser(fakeFor(admin));

    const response = await updateRobot(
      makeRequest(`/api/admin/robots/${robot.id}`, {
        method: "PATCH",
        body: { action: "planReturn", planId: plan.id, dailyReturnPercentage: "3.75" },
      }),
      { params: Promise.resolve({ id: robot.id }) },
    );
    expect(response.status).toBe(200);
    await expect(prisma.robotPlan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      dailyReturnPercentage: new Prisma.Decimal("3.75"),
    });
    await expect(prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } })).resolves.toMatchObject({
      dailyReturnPercentage: new Prisma.Decimal("2.50"),
    });
    await expect(prisma.auditLog.count({ where: { action: "robot.plan_return_changed", entityId: plan.id } })).resolves.toBe(1);

    const invalid = await updateRobot(
      makeRequest(`/api/admin/robots/${robot.id}`, {
        method: "PATCH",
        body: { action: "planReturn", planId: plan.id, dailyReturnPercentage: "101" },
      }),
      { params: Promise.resolve({ id: robot.id }) },
    );
    expect(invalid.status).toBe(400);
  });
});

async function seedPlan(durationDays: number) {
  const robot = await prisma.robot.create({
    data: {
      name: "Earnings Test",
      slug: "earnings-test",
      description: "Integration-test robot for daily credit accounting.",
      strategyDescription: "No real trading or market activity is used.",
      market: "BTC/USD",
      riskLevel: "MEDIUM",
      robotType: "TEST",
      status: "ACTIVE",
    },
  });
  const plan = await prisma.robotPlan.create({
    data: {
      robotId: robot.id,
      name: `${durationDays} day test plan`,
      durationDays,
      price: "1000.00",
      currency: CURRENCY,
      dailyReturnPercentage: "2.50",
      status: "ACTIVE",
    },
  });
  const user = await createUser();
  return { user, robot, plan };
}
