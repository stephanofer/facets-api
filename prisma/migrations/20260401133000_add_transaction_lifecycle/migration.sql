CREATE TYPE "TransactionStatus" AS ENUM ('ACTIVE', 'VOIDED');

ALTER TABLE "transactions"
ADD COLUMN "status" "TransactionStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "voidedAt" TIMESTAMP(3),
ADD COLUMN "voidReason" VARCHAR(255);

CREATE INDEX "transactions_workspaceId_status_date_idx"
ON "transactions"("workspaceId", "status", "date");
