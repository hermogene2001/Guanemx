import { describe, expect, it } from "vitest";
import { calculateCycleEarning, calculateDailyEarning, getNextRobotEarningDueAt } from "@/lib/robot-earnings";

describe("calculateDailyEarning", () => {
  it("calculates the configured percentage using decimal arithmetic", () => {
    expect(calculateDailyEarning("10000.00", "2.50").toFixed(2)).toBe("250.00");
  });

  it("rounds half up to the smallest currency unit", () => {
    expect(calculateDailyEarning("1.00", "0.50").toFixed(2)).toBe("0.01");
    expect(calculateDailyEarning("1.00", "0.49").toFixed(2)).toBe("0.00");
  });

  it("supports decimal investment values without binary floating-point drift", () => {
    expect(calculateDailyEarning("123.45", "2.5").toFixed(2)).toBe("3.09");
  });
});

describe("calculateCycleEarning", () => {
  it("totals the daily credited amount across the full plan duration", () => {
    expect(calculateCycleEarning("45000", "2.5", 30).toFixed(2)).toBe("33750.00");
  });

  it("uses the same per-day rounding as wallet credits", () => {
    expect(calculateCycleEarning("1.00", "0.50", 10).toFixed(2)).toBe("0.10");
  });
});

describe("getNextRobotEarningDueAt", () => {
  it("schedules the first credit 24 hours after start and each later day sequentially", () => {
    const startAt = new Date("2026-10-11T00:00:00.000Z");
    expect(getNextRobotEarningDueAt(startAt, 0).toISOString()).toBe("2026-10-12T00:00:00.000Z");
    expect(getNextRobotEarningDueAt(startAt, 2).toISOString()).toBe("2026-10-14T00:00:00.000Z");
  });
});
