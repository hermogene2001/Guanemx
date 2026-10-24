ALTER TABLE "recharge_requests"
ADD COLUMN "paymentMethod" VARCHAR(20) NOT NULL DEFAULT 'AGENT',
ADD COLUMN "cryptoName" VARCHAR(40),
ADD COLUMN "cryptoNetwork" VARCHAR(60),
ADD COLUMN "cryptoAddress" VARCHAR(200);

CREATE TABLE "crypto_wallets" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "network" VARCHAR(60) NOT NULL,
    "address" VARCHAR(200) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crypto_wallets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crypto_wallets_enabled_name_idx" ON "crypto_wallets"("enabled", "name");
