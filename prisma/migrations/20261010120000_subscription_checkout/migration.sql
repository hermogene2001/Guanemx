ALTER TABLE "subscriptions" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "subscriptions_idempotencyKey_key" ON "subscriptions"("idempotencyKey");
