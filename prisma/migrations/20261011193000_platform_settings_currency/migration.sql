-- Platform settings and US dollars as the platform currency.
--
-- Existing rows keep the currency code they were recorded with; only the
-- default for new recharge requests changes. Operators who hold pre-existing
-- RWF data must migrate those rows deliberately (a fixed 1:1 relabel would
-- misstate balances), so no data rows are rewritten here.

ALTER TABLE "recharge_requests" ALTER COLUMN "currency" SET DEFAULT 'USD';

CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "usdToRwfRate" DECIMAL(18,4) NOT NULL DEFAULT 1400,
    "withdrawalFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "referralBonusPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "platform_settings" ("id", "usdToRwfRate", "withdrawalFeePercent", "referralBonusPercent", "updatedAt")
VALUES ('default', 1400, 10, 0, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
