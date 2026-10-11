import { describe, expect, it } from "vitest";
import { CURRENCY, currencySymbol, formatMoney, formatRwf, formatUsd, usdToRwf } from "@/lib/money";

describe("money helpers", () => {
  it("formats USD amounts with a dollar sign and two decimals", () => {
    expect(formatUsd("1234.5")).toBe("$1,234.50");
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd("100000")).toBe("$100,000.00");
  });

  it("formats RWF equivalents as whole units", () => {
    expect(formatRwf("1400")).toBe("RWF 1,400");
    expect(formatRwf(1400.6)).toBe("RWF 1,401");
  });

  it("defaults to USD and respects an explicit stored currency", () => {
    expect(CURRENCY).toBe("USD");
    expect(formatMoney("10")).toBe("$10.00");
    expect(formatMoney("10", "RWF")).toBe("RWF 10");
  });

  it("maps currency codes to display symbols", () => {
    expect(currencySymbol()).toBe("$");
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("RWF")).toBe("RWF");
  });

  it("converts a USD amount to RWF using the configured rate", () => {
    expect(usdToRwf("2", "1400")).toBe(2800);
    expect(usdToRwf(0, 1400)).toBe(0);
  });
});
