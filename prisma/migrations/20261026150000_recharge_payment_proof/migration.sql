ALTER TABLE "recharge_requests"
ADD COLUMN "proofData" BYTEA,
ADD COLUMN "proofContentType" VARCHAR(100),
ADD COLUMN "proofFileName" VARCHAR(255),
ADD COLUMN "proofUploadedAt" TIMESTAMP(3);
