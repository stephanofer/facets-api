-- CreateEnum
CREATE TYPE "PlanChangeType" AS ENUM ('UPGRADE', 'DOWNGRADE_SCHEDULED', 'DOWNGRADE_APPLIED', 'CANCELLATION', 'CANCELLATION_APPLIED', 'REACTIVATION');

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "graceOverages" JSONB,
ADD COLUMN     "gracePeriodEnd" TIMESTAMP(3),
ADD COLUMN     "scheduledChangeAt" TIMESTAMP(3),
ADD COLUMN     "scheduledPlanId" TEXT;

-- CreateTable
CREATE TABLE "plan_change_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromPlanId" TEXT NOT NULL,
    "toPlanId" TEXT NOT NULL,
    "changeType" "PlanChangeType" NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "prorationAmount" DECIMAL(10,2),
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_change_logs_userId_idx" ON "plan_change_logs"("userId");

-- CreateIndex
CREATE INDEX "plan_change_logs_createdAt_idx" ON "plan_change_logs"("createdAt");

-- CreateIndex
CREATE INDEX "subscriptions_scheduledChangeAt_idx" ON "subscriptions"("scheduledChangeAt");

-- CreateIndex
CREATE INDEX "subscriptions_gracePeriodEnd_idx" ON "subscriptions"("gracePeriodEnd");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_scheduledPlanId_fkey" FOREIGN KEY ("scheduledPlanId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_change_logs" ADD CONSTRAINT "plan_change_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_change_logs" ADD CONSTRAINT "plan_change_logs_fromPlanId_fkey" FOREIGN KEY ("fromPlanId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_change_logs" ADD CONSTRAINT "plan_change_logs_toPlanId_fkey" FOREIGN KEY ("toPlanId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
