CREATE TABLE "recharge_messages" (
    "id" TEXT NOT NULL,
    "rechargeRequestId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recharge_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recharge_messages_rechargeRequestId_createdAt_idx"
ON "recharge_messages"("rechargeRequestId", "createdAt");

ALTER TABLE "recharge_messages"
ADD CONSTRAINT "recharge_messages_rechargeRequestId_fkey"
FOREIGN KEY ("rechargeRequestId") REFERENCES "recharge_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recharge_messages"
ADD CONSTRAINT "recharge_messages_senderId_fkey"
FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
