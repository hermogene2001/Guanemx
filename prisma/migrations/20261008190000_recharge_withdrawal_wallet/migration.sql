-- CreateEnum
CREATE TYPE "RechargeStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WalletBalanceType" AS ENUM ('MAIN', 'GROWTH');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LedgerEntryType" ADD VALUE 'FEE';
ALTER TYPE "LedgerEntryType" ADD VALUE 'REFERRAL_BONUS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'FEE';
ALTER TYPE "TransactionType" ADD VALUE 'REFERRAL_BONUS';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'AGENT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "invitedById" TEXT,
ADD COLUMN     "referralCode" TEXT;

-- AlterTable
ALTER TABLE "wallet_ledger" ADD COLUMN     "balanceType" "WalletBalanceType" NOT NULL DEFAULT 'MAIN';

-- AlterTable
ALTER TABLE "wallets" ADD COLUMN     "growthBalance" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "withdrawals" ADD COLUMN     "assignedAgentId" TEXT,
ADD COLUMN     "fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "netPayout" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "payoutDestinationId" TEXT,
ADD COLUMN     "sourceBalance" "WalletBalanceType" NOT NULL DEFAULT 'MAIN';

-- CreateTable
CREATE TABLE "recharge_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAgentId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'RWF',
    "status" "RechargeStatus" NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "idempotencyKey" TEXT,
    "reviewReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recharge_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_destinations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "accountHolder" VARCHAR(120) NOT NULL,
    "accountNumberEncrypted" TEXT NOT NULL,
    "accountNumberLast4" VARCHAR(4) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_destinations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recharge_requests_transactionId_key" ON "recharge_requests"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "recharge_requests_idempotencyKey_key" ON "recharge_requests"("idempotencyKey");

-- CreateIndex
CREATE INDEX "recharge_requests_userId_createdAt_idx" ON "recharge_requests"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "recharge_requests_assignedAgentId_status_createdAt_idx" ON "recharge_requests"("assignedAgentId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "payout_destinations_userId_isDefault_idx" ON "payout_destinations"("userId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_payoutDestinationId_fkey" FOREIGN KEY ("payoutDestinationId") REFERENCES "payout_destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recharge_requests" ADD CONSTRAINT "recharge_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recharge_requests" ADD CONSTRAINT "recharge_requests_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recharge_requests" ADD CONSTRAINT "recharge_requests_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recharge_requests" ADD CONSTRAINT "recharge_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_destinations" ADD CONSTRAINT "payout_destinations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
