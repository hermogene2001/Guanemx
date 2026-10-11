import { Prisma } from "@prisma/client";
import {
  configuredReferralBonusPercent,
  configuredUsdToRwfRate,
  configuredWithdrawalFeePercent,
} from "@/lib/finance";
import { prisma } from "@/lib/prisma";

/**
 * Platform-wide, administrator-controlled settings.
 *
 * Stored as a single ("singleton") row so money logic reads one source of
 * truth. Falls back to environment-configured defaults when the row has not
 * been created yet (for example, a brand-new database).
 */

export const PLATFORM_SETTINGS_ID = "default";

export type PlatformSettings = {
  usdToRwfRate: Prisma.Decimal;
  withdrawalFeePercent: Prisma.Decimal;
  referralBonusPercent: Prisma.Decimal;
  updatedAt: Date | null;
  updatedById: string | null;
};

export type PlatformSettingsInput = {
  usdToRwfRate: Prisma.Decimal.Value;
  withdrawalFeePercent: Prisma.Decimal.Value;
  referralBonusPercent: Prisma.Decimal.Value;
};

export function defaultPlatformSettings(): PlatformSettings {
  return {
    usdToRwfRate: configuredUsdToRwfRate(),
    withdrawalFeePercent: configuredWithdrawalFeePercent(),
    referralBonusPercent: new Prisma.Decimal(configuredReferralBonusPercent()),
    updatedAt: null,
    updatedById: null,
  };
}

/** Reads the current settings, inside or outside a transaction. */
export async function getPlatformSettings(client: Prisma.TransactionClient = prisma): Promise<PlatformSettings> {
  const row = await client.platformSetting.findUnique({ where: { id: PLATFORM_SETTINGS_ID } });
  if (!row) return defaultPlatformSettings();
  return {
    usdToRwfRate: row.usdToRwfRate,
    withdrawalFeePercent: row.withdrawalFeePercent,
    referralBonusPercent: row.referralBonusPercent,
    updatedAt: row.updatedAt,
    updatedById: row.updatedById,
  };
}

/** Creates or replaces the singleton settings row. Callers record an audit entry. */
export async function savePlatformSettings(
  input: PlatformSettingsInput,
  updatedById: string,
  client: Prisma.TransactionClient = prisma,
): Promise<PlatformSettings> {
  const data = {
    usdToRwfRate: new Prisma.Decimal(input.usdToRwfRate),
    withdrawalFeePercent: new Prisma.Decimal(input.withdrawalFeePercent),
    referralBonusPercent: new Prisma.Decimal(input.referralBonusPercent),
    updatedById,
  };
  const row = await client.platformSetting.upsert({
    where: { id: PLATFORM_SETTINGS_ID },
    create: { id: PLATFORM_SETTINGS_ID, ...data },
    update: data,
  });
  return {
    usdToRwfRate: row.usdToRwfRate,
    withdrawalFeePercent: row.withdrawalFeePercent,
    referralBonusPercent: row.referralBonusPercent,
    updatedAt: row.updatedAt,
    updatedById: row.updatedById,
  };
}

/** Serializable shape for API responses. */
export function serializePlatformSettings(settings: PlatformSettings) {
  return {
    usdToRwfRate: settings.usdToRwfRate.toFixed(4),
    withdrawalFeePercent: settings.withdrawalFeePercent.toFixed(2),
    referralBonusPercent: settings.referralBonusPercent.toFixed(2),
    updatedAt: settings.updatedAt?.toISOString() ?? null,
    updatedById: settings.updatedById,
  };
}
