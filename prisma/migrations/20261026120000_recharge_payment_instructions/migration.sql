ALTER TABLE "recharge_requests"
ADD COLUMN "paymentInstructions" TEXT,
ADD COLUMN "instructionsSentAt" TIMESTAMP(3),
ADD COLUMN "instructionsSenderId" TEXT;

ALTER TABLE "recharge_requests"
ADD CONSTRAINT "recharge_requests_instructionsSenderId_fkey"
FOREIGN KEY ("instructionsSenderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
