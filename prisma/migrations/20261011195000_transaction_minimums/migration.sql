ALTER TABLE "platform_settings"
ADD COLUMN "minimumDepositAmount" DECIMAL(18,2) NOT NULL DEFAULT 3000,
ADD COLUMN "minimumWithdrawalAmount" DECIMAL(18,2) NOT NULL DEFAULT 1000;
