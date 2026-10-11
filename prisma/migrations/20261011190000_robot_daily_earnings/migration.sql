ALTER TYPE "TransactionType" ADD VALUE 'ROBOT_EARNING';
ALTER TYPE "LedgerEntryType" ADD VALUE 'ROBOT_EARNING';

ALTER TABLE "robot_plans"
ADD COLUMN "dailyReturnPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0;

ALTER TABLE "subscriptions"
ADD COLUMN "dailyReturnPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN "daysCompleted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastCreditedAt" TIMESTAMP(3);

ALTER TABLE "transactions"
ADD COLUMN "robotId" TEXT,
ADD COLUMN "subscriptionId" TEXT;

CREATE INDEX "transactions_subscriptionId_type_createdAt_idx"
ON "transactions"("subscriptionId", "type", "createdAt");

CREATE INDEX "subscriptions_status_lastCreditedAt_idx"
ON "subscriptions"("status", "lastCreditedAt");

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_robotId_fkey"
FOREIGN KEY ("robotId") REFERENCES "robots"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "transactions_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "cron_job_runs" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    CONSTRAINT "cron_job_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cron_job_runs_job_startedAt_idx" ON "cron_job_runs"("job", "startedAt");
