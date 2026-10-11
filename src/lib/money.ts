/**
 * Client-safe money helpers.
 *
 * This module intentionally imports nothing from Node or Prisma so it can be
 * used from both server and client components. Keep it free of side effects.
 *
 * The platform's native currency is US dollars (USD). Rwandan-franc helpers
 * exist only to show the off-platform equivalent agents handle in cash; the
 * conversion rate is set by an administrator (see `@/lib/settings`).
 */

export const CURRENCY = "USD";

type MoneyValue = number | string | { toString(): string };

function toNumber(value: MoneyValue) {
  return Number(value.toString());
}

/** Formats an amount as US dollars, e.g. `$1,234.50`. */
export function formatUsd(value: MoneyValue) {
  return `$${toNumber(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Formats an amount as Rwandan francs (whole units), e.g. `RWF 1,234,500`. */
export function formatRwf(value: MoneyValue) {
  return `RWF ${Math.round(toNumber(value)).toLocaleString("en-US")}`;
}

/** The symbol shown for a stored currency code. */
export function currencySymbol(currency: string = CURRENCY) {
  return currency === "USD" ? "$" : currency;
}

/** Formats an amount using the stored currency code it was recorded in. */
export function formatMoney(value: MoneyValue, currency: string = CURRENCY) {
  return currency === "USD" ? formatUsd(value) : formatRwf(value);
}

/** Converts a USD amount to its RWF equivalent using an admin-set rate. */
export function usdToRwf(value: MoneyValue, rate: MoneyValue) {
  return toNumber(value) * toNumber(rate);
}
