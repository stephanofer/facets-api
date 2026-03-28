/*
  Warnings:

  - The values [DEBIT_CARD,SAVINGS,INVESTMENT,DIGITAL_WALLET,OTHER] on the enum `AccountType` will be removed. If these variants are still used in the database, this will fail.
  - The values [AVATAR,TRANSACTION_RECEIPT] on the enum `FilePurpose` will be removed. If these variants are still used in the database, this will fail.
  - The values [DOWNGRADE_SCHEDULED,DOWNGRADE_APPLIED,CANCELLATION_APPLIED] on the enum `PlanChangeType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `balance` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `color` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `createdByUserId` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `creditLimit` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `icon` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `includeInTotal` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `isArchived` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `paymentDueDay` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `sortOrder` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `statementClosingDay` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `updatedByUserId` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `isSystem` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `transactionId` on the `files` table. All the data in the column will be lost.
  - You are about to drop the column `featureType` on the `plan_features` table. All the data in the column will be lost.
  - You are about to alter the column `featureCode` on the `plan_features` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to drop the column `scheduledChangeAt` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledPlanId` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `exchangeRate` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `isPending` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `isReconciled` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `recurringPaymentId` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `transferToAccountId` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `transactions` table. All the data in the column will be lost.
  - You are about to alter the column `description` on the `transactions` table. The data in that column could be lost. The data in that column will be cast from `VarChar(500)` to `VarChar(255)`.
  - You are about to alter the column `featureCode` on the `usage_records` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to drop the column `avatarFileId` on the `user_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `locale` on the `user_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `timezone` on the `user_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `baseLanguage` on the `workspace_settings` table. All the data in the column will be lost.
  - You are about to drop the column `locale` on the `workspace_settings` table. All the data in the column will be lost.
  - You are about to drop the column `timezone` on the `workspace_settings` table. All the data in the column will be lost.
  - You are about to drop the `debt_payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `debts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `goal_contributions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `goals` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `loan_payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `loans` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `preference_definitions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `recurring_payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_preferences` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[workspaceId,id]` on the table `accounts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspaceId,id]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspaceId,key]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspaceId,parentId,name,kind]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[providerSubscriptionId]` on the table `subscriptions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspaceId,id]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspaceId,sourceDedupKey]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspaceId,sourceProvider,sourceExternalId]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspaceId,featureCode,periodType,periodStart]` on the table `usage_records` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspaceId,userId]` on the table `workspace_memberships` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `kind` to the `categories` table without a default value. This is not possible if the table is not empty.
  - Made the column `workspaceId` on table `categories` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `planCodeSnapshot` to the `subscriptions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `planNameSnapshot` to the `subscriptions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `direction` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Made the column `description` on table `transactions` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "PlanChangeStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'APPLIED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "PlanChangeSource" AS ENUM ('USER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "UsageEventSource" AS ENUM ('APP', 'IMPORT', 'SYSTEM', 'BACKFILL');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LentMoneyStatus" AS ENUM ('OPEN', 'SETTLED', 'FORGIVEN');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('STANDARD', 'FUNDS_MOVEMENT', 'CC_PAYMENT', 'LOAN_PAYMENT', 'DEBT_PAYMENT', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReminderAmountType" AS ENUM ('FIXED', 'RANGE');

-- AlterEnum
BEGIN;
CREATE TYPE "AccountType_new" AS ENUM ('CASH', 'BANK', 'CREDIT_CARD', 'DEBT', 'LOAN', 'LENT_MONEY');
ALTER TABLE "accounts" ALTER COLUMN "type" TYPE "AccountType_new" USING ("type"::text::"AccountType_new");
ALTER TYPE "AccountType" RENAME TO "AccountType_old";
ALTER TYPE "AccountType_new" RENAME TO "AccountType";
DROP TYPE "public"."AccountType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "FilePurpose_new" AS ENUM ('ATTACHMENT');
ALTER TABLE "files" ALTER COLUMN "purpose" TYPE "FilePurpose_new" USING ("purpose"::text::"FilePurpose_new");
ALTER TYPE "FilePurpose" RENAME TO "FilePurpose_old";
ALTER TYPE "FilePurpose_new" RENAME TO "FilePurpose";
DROP TYPE "public"."FilePurpose_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PlanChangeType_new" AS ENUM ('UPGRADE', 'DOWNGRADE', 'CANCELLATION', 'REACTIVATION');
ALTER TABLE "plan_change_logs" ALTER COLUMN "changeType" TYPE "PlanChangeType_new" USING ("changeType"::text::"PlanChangeType_new");
ALTER TYPE "PlanChangeType" RENAME TO "PlanChangeType_old";
ALTER TYPE "PlanChangeType_new" RENAME TO "PlanChangeType";
DROP TYPE "public"."PlanChangeType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_updatedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "categories" DROP CONSTRAINT "categories_parentId_fkey";

-- DropForeignKey
ALTER TABLE "debt_payments" DROP CONSTRAINT "debt_payments_accountId_fkey";

-- DropForeignKey
ALTER TABLE "debt_payments" DROP CONSTRAINT "debt_payments_currencyCode_fkey";

-- DropForeignKey
ALTER TABLE "debt_payments" DROP CONSTRAINT "debt_payments_debtId_fkey";

-- DropForeignKey
ALTER TABLE "debt_payments" DROP CONSTRAINT "debt_payments_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "debts" DROP CONSTRAINT "debts_currencyCode_fkey";

-- DropForeignKey
ALTER TABLE "debts" DROP CONSTRAINT "debts_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "files" DROP CONSTRAINT "files_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "goal_contributions" DROP CONSTRAINT "goal_contributions_accountId_fkey";

-- DropForeignKey
ALTER TABLE "goal_contributions" DROP CONSTRAINT "goal_contributions_currencyCode_fkey";

-- DropForeignKey
ALTER TABLE "goal_contributions" DROP CONSTRAINT "goal_contributions_goalId_fkey";

-- DropForeignKey
ALTER TABLE "goal_contributions" DROP CONSTRAINT "goal_contributions_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "goals" DROP CONSTRAINT "goals_currencyCode_fkey";

-- DropForeignKey
ALTER TABLE "goals" DROP CONSTRAINT "goals_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "loan_payments" DROP CONSTRAINT "loan_payments_accountId_fkey";

-- DropForeignKey
ALTER TABLE "loan_payments" DROP CONSTRAINT "loan_payments_currencyCode_fkey";

-- DropForeignKey
ALTER TABLE "loan_payments" DROP CONSTRAINT "loan_payments_loanId_fkey";

-- DropForeignKey
ALTER TABLE "loan_payments" DROP CONSTRAINT "loan_payments_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "loans" DROP CONSTRAINT "loans_currencyCode_fkey";

-- DropForeignKey
ALTER TABLE "loans" DROP CONSTRAINT "loans_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "plan_change_logs" DROP CONSTRAINT "plan_change_logs_fromPlanId_fkey";

-- DropForeignKey
ALTER TABLE "plan_change_logs" DROP CONSTRAINT "plan_change_logs_toPlanId_fkey";

-- DropForeignKey
ALTER TABLE "recurring_payments" DROP CONSTRAINT "recurring_payments_accountId_fkey";

-- DropForeignKey
ALTER TABLE "recurring_payments" DROP CONSTRAINT "recurring_payments_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_scheduledPlanId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_accountId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_recurringPaymentId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_transferToAccountId_fkey";

-- DropForeignKey
ALTER TABLE "user_preferences" DROP CONSTRAINT "user_preferences_preferenceId_fkey";

-- DropForeignKey
ALTER TABLE "user_preferences" DROP CONSTRAINT "user_preferences_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_avatarFileId_fkey";

-- DropForeignKey
ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_currencyCode_fkey";

-- DropIndex
DROP INDEX "accounts_createdByUserId_idx";

-- DropIndex
DROP INDEX "accounts_updatedByUserId_idx";

-- DropIndex
DROP INDEX "accounts_workspaceId_isArchived_idx";

-- DropIndex
DROP INDEX "accounts_workspaceId_type_idx";

-- DropIndex
DROP INDEX "categories_isSystem_type_isActive_idx";

-- DropIndex
DROP INDEX "categories_name_type_key";

-- DropIndex
DROP INDEX "categories_name_type_parentId_key";

-- DropIndex
DROP INDEX "categories_parentId_idx";

-- DropIndex
DROP INDEX "categories_workspaceId_name_type_key";

-- DropIndex
DROP INDEX "categories_workspaceId_name_type_parentId_key";

-- DropIndex
DROP INDEX "categories_workspaceId_type_isActive_idx";

-- DropIndex
DROP INDEX "files_transactionId_idx";

-- DropIndex
DROP INDEX "subscriptions_gracePeriodEnd_idx";

-- DropIndex
DROP INDEX "subscriptions_scheduledChangeAt_idx";

-- DropIndex
DROP INDEX "transactions_accountId_idx";

-- DropIndex
DROP INDEX "transactions_recurringPaymentId_idx";

-- DropIndex
DROP INDEX "transactions_transferToAccountId_idx";

-- DropIndex
DROP INDEX "transactions_workspaceId_accountId_date_idx";

-- DropIndex
DROP INDEX "transactions_workspaceId_categoryId_date_idx";

-- DropIndex
DROP INDEX "transactions_workspaceId_date_idx";

-- DropIndex
DROP INDEX "transactions_workspaceId_type_date_idx";

-- DropIndex
DROP INDEX "usage_records_workspaceId_featureCode_idx";

-- DropIndex
DROP INDEX "usage_records_workspaceId_featureCode_periodStart_key";

-- DropIndex
DROP INDEX "user_profiles_avatarFileId_key";

-- DropIndex
DROP INDEX "user_profiles_currencyCode_idx";

-- DropIndex
DROP INDEX "workspace_memberships_workspaceId_key";

-- DropIndex
DROP INDEX "workspace_memberships_workspaceId_userId_key";

-- AlterTable
ALTER TABLE "accounts" DROP COLUMN "balance",
DROP COLUMN "color",
DROP COLUMN "createdByUserId",
DROP COLUMN "creditLimit",
DROP COLUMN "icon",
DROP COLUMN "includeInTotal",
DROP COLUMN "isArchived",
DROP COLUMN "paymentDueDay",
DROP COLUMN "sortOrder",
DROP COLUMN "statementClosingDay",
DROP COLUMN "updatedByUserId",
ADD COLUMN     "currentBalanceCached" DECIMAL(19,4) NOT NULL DEFAULT 0,
ADD COLUMN     "includeInReports" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "initialBalance" DECIMAL(19,4) NOT NULL DEFAULT 0,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "name" SET DATA TYPE VARCHAR(120),
ALTER COLUMN "currencyCode" DROP DEFAULT;

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "isSystem",
DROP COLUMN "type",
ADD COLUMN     "key" VARCHAR(100),
ADD COLUMN     "kind" "CategoryKind" NOT NULL,
ALTER COLUMN "name" SET DATA TYPE VARCHAR(120),
ALTER COLUMN "icon" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "color" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "workspaceId" SET NOT NULL;

-- AlterTable
ALTER TABLE "files" DROP COLUMN "transactionId";

-- AlterTable
ALTER TABLE "plan_change_logs" ADD COLUMN     "billingAmount" DECIMAL(10,2),
ADD COLUMN     "billingCurrency" VARCHAR(3),
ADD COLUMN     "billingInterval" "BillingInterval",
ADD COLUMN     "fromPlanCodeSnapshot" VARCHAR(100),
ADD COLUMN     "resultingSubscriptionStatus" "SubscriptionStatus",
ADD COLUMN     "source" "PlanChangeSource" NOT NULL DEFAULT 'USER',
ADD COLUMN     "status" "PlanChangeStatus" NOT NULL DEFAULT 'REQUESTED',
ADD COLUMN     "toPlanCodeSnapshot" VARCHAR(100),
ALTER COLUMN "fromPlanId" DROP NOT NULL,
ALTER COLUMN "toPlanId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "plan_features" DROP COLUMN "featureType",
ADD COLUMN     "overrideType" "FeatureType",
ALTER COLUMN "featureCode" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "scheduledChangeAt",
DROP COLUMN "scheduledPlanId",
ADD COLUMN     "billingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "billingCurrency" VARCHAR(3) NOT NULL DEFAULT 'USD',
ADD COLUMN     "billingInterval" "BillingInterval",
ADD COLUMN     "planCodeSnapshot" VARCHAR(100) NOT NULL,
ADD COLUMN     "planNameSnapshot" VARCHAR(120) NOT NULL,
ADD COLUMN     "providerCustomerId" VARCHAR(191),
ADD COLUMN     "providerSubscriptionId" VARCHAR(191);

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "exchangeRate",
DROP COLUMN "isPending",
DROP COLUMN "isReconciled",
DROP COLUMN "recurringPaymentId",
DROP COLUMN "source",
DROP COLUMN "tags",
DROP COLUMN "transferToAccountId",
DROP COLUMN "type",
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "direction" "TransactionDirection" NOT NULL,
ADD COLUMN     "isExcludedFromReports" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" "TransactionKind" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "sourceDedupKey" VARCHAR(255),
ADD COLUMN     "sourceExternalId" VARCHAR(191),
ADD COLUMN     "sourceProvider" VARCHAR(50),
ADD COLUMN     "systemMerchantId" TEXT,
ADD COLUMN     "workspaceMerchantId" TEXT,
ALTER COLUMN "currencyCode" DROP DEFAULT,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "description" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "usage_records" ALTER COLUMN "featureCode" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "user_profiles" DROP COLUMN "avatarFileId",
DROP COLUMN "locale",
DROP COLUMN "timezone",
ADD COLUMN     "avatarUrl" VARCHAR(500),
ALTER COLUMN "currencyCode" DROP NOT NULL,
ALTER COLUMN "currencyCode" DROP DEFAULT;

-- AlterTable
ALTER TABLE "workspace_memberships" ADD COLUMN     "invitedAt" TIMESTAMP(3),
ALTER COLUMN "joinedAt" DROP NOT NULL,
ALTER COLUMN "joinedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "workspace_settings" DROP COLUMN "baseLanguage",
DROP COLUMN "locale",
DROP COLUMN "timezone",
ADD COLUMN     "contentLocale" VARCHAR(10) NOT NULL DEFAULT 'en-US',
ADD COLUMN     "financialTimezone" VARCHAR(50) NOT NULL DEFAULT 'UTC';

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "financialDataUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "debt_payments";

-- DropTable
DROP TABLE "debts";

-- DropTable
DROP TABLE "goal_contributions";

-- DropTable
DROP TABLE "goals";

-- DropTable
DROP TABLE "loan_payments";

-- DropTable
DROP TABLE "loans";

-- DropTable
DROP TABLE "preference_definitions";

-- DropTable
DROP TABLE "recurring_payments";

-- DropTable
DROP TABLE "user_preferences";

-- DropEnum
DROP TYPE "DebtDirection";

-- DropEnum
DROP TYPE "DebtStatus";

-- DropEnum
DROP TYPE "GoalStatus";

-- DropEnum
DROP TYPE "InterestType";

-- DropEnum
DROP TYPE "LoanDirection";

-- DropEnum
DROP TYPE "LoanPaymentStatus";

-- DropEnum
DROP TYPE "LoanStatus";

-- DropEnum
DROP TYPE "PreferenceCategory";

-- DropEnum
DROP TYPE "PreferenceDataType";

-- DropEnum
DROP TYPE "RecurringFrequency";

-- DropEnum
DROP TYPE "RecurringStatus";

-- DropEnum
DROP TYPE "TransactionSource";

-- DropEnum
DROP TYPE "TransactionType";

-- CreateTable
CREATE TABLE "workspace_user_preferences" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "uiLocale" VARCHAR(10),
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "dateFormat" VARCHAR(30),
    "dashboardPreferences" JSONB NOT NULL DEFAULT '{}',
    "reportPreferences" JSONB NOT NULL DEFAULT '{}',
    "transactionPreferences" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_definitions" (
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "featureType" "FeatureType" NOT NULL,
    "defaultLimitType" "FeatureLimitType" NOT NULL DEFAULT 'BOOLEAN',
    "defaultLimitPeriod" "LimitPeriod",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_definitions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "usage_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "featureCode" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "source" "UsageEventSource" NOT NULL DEFAULT 'APP',
    "idempotencyKey" VARCHAR(191),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_daily_balances" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "openingBalance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "inflowsAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "outflowsAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "adjustmentsAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "closingBalance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_daily_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_profiles" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "lenderName" VARCHAR(120),
    "interestRate" DECIMAL(8,4),
    "estimatedInstallmentAmount" DECIMAL(19,4),
    "termMonths" INTEGER,
    "dueDayOfMonth" INTEGER,
    "startedAt" DATE,
    "maturityDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_card_profiles" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "issuerName" VARCHAR(120),
    "last4" VARCHAR(4),
    "creditLimit" DECIMAL(19,4),
    "closingDayOfMonth" INTEGER,
    "dueDayOfMonth" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_card_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_profiles" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "creditorName" VARCHAR(120),
    "dueDate" DATE,
    "reference" VARCHAR(120),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debt_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lent_money_profiles" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "borrowerName" VARCHAR(120),
    "expectedRepaymentDate" DATE,
    "status" "LentMoneyStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lent_money_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_reconciliations" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "date" DATE NOT NULL,
    "targetBalance" DECIMAL(19,4) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_merchants" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "normalizedName" VARCHAR(160) NOT NULL,
    "logoUrl" VARCHAR(500),
    "suggestedCategoryKey" VARCHAR(100),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_merchants" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "normalizedName" VARCHAR(160) NOT NULL,
    "logoUrl" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "normalizedName" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_tags" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fromTransactionId" TEXT NOT NULL,
    "toTransactionId" TEXT NOT NULL,
    "fxRateUsed" DECIMAL(20,10),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "fromCurrencyCode" VARCHAR(3) NOT NULL,
    "toCurrencyCode" VARCHAR(3) NOT NULL,
    "date" DATE NOT NULL,
    "rate" DECIMAL(20,10) NOT NULL,
    "source" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "BudgetStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_lines" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_reminders" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "expectedDayOfMonth" INTEGER NOT NULL,
    "amountType" "ReminderAmountType" NOT NULL,
    "amount" DECIMAL(19,4),
    "amountMin" DECIMAL(19,4),
    "amountMax" DECIMAL(19,4),
    "currencyCode" VARCHAR(3) NOT NULL,
    "categoryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_user_preferences_workspaceId_idx" ON "workspace_user_preferences"("workspaceId");

-- CreateIndex
CREATE INDEX "workspace_user_preferences_userId_idx" ON "workspace_user_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_user_preferences_workspaceId_userId_key" ON "workspace_user_preferences"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "feature_definitions_isActive_featureType_idx" ON "feature_definitions"("isActive", "featureType");

-- CreateIndex
CREATE INDEX "usage_events_workspaceId_featureCode_occurredAt_idx" ON "usage_events"("workspaceId", "featureCode", "occurredAt");

-- CreateIndex
CREATE INDEX "usage_events_workspaceId_source_occurredAt_idx" ON "usage_events"("workspaceId", "source", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "usage_events_workspaceId_idempotencyKey_key" ON "usage_events"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "account_daily_balances_accountId_date_idx" ON "account_daily_balances"("accountId", "date");

-- CreateIndex
CREATE INDEX "account_daily_balances_date_idx" ON "account_daily_balances"("date");

-- CreateIndex
CREATE UNIQUE INDEX "account_daily_balances_accountId_date_key" ON "account_daily_balances"("accountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "loan_profiles_accountId_key" ON "loan_profiles"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_card_profiles_accountId_key" ON "credit_card_profiles"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "debt_profiles_accountId_key" ON "debt_profiles"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "lent_money_profiles_accountId_key" ON "lent_money_profiles"("accountId");

-- CreateIndex
CREATE INDEX "account_reconciliations_accountId_date_createdAt_idx" ON "account_reconciliations"("accountId", "date", "createdAt");

-- CreateIndex
CREATE INDEX "account_reconciliations_createdByUserId_idx" ON "account_reconciliations"("createdByUserId");

-- CreateIndex
CREATE INDEX "system_merchants_isActive_idx" ON "system_merchants"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "system_merchants_normalizedName_key" ON "system_merchants"("normalizedName");

-- CreateIndex
CREATE INDEX "workspace_merchants_workspaceId_isActive_idx" ON "workspace_merchants"("workspaceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_merchants_workspaceId_id_key" ON "workspace_merchants"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_merchants_workspaceId_normalizedName_key" ON "workspace_merchants"("workspaceId", "normalizedName");

-- CreateIndex
CREATE INDEX "tags_workspaceId_idx" ON "tags"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_workspaceId_id_key" ON "tags"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_workspaceId_normalizedName_key" ON "tags"("workspaceId", "normalizedName");

-- CreateIndex
CREATE INDEX "transaction_tags_workspaceId_idx" ON "transaction_tags"("workspaceId");

-- CreateIndex
CREATE INDEX "transaction_tags_tagId_idx" ON "transaction_tags"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_tags_transactionId_tagId_key" ON "transaction_tags"("transactionId", "tagId");

-- CreateIndex
CREATE INDEX "transfers_workspaceId_idx" ON "transfers"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_workspaceId_fromTransactionId_key" ON "transfers"("workspaceId", "fromTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_workspaceId_toTransactionId_key" ON "transfers"("workspaceId", "toTransactionId");

-- CreateIndex
CREATE INDEX "exchange_rates_fromCurrencyCode_toCurrencyCode_idx" ON "exchange_rates"("fromCurrencyCode", "toCurrencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_fromCurrencyCode_toCurrencyCode_date_key" ON "exchange_rates"("fromCurrencyCode", "toCurrencyCode", "date");

-- CreateIndex
CREATE INDEX "budgets_workspaceId_periodStart_idx" ON "budgets"("workspaceId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_workspaceId_id_key" ON "budgets"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_workspaceId_periodStart_periodEnd_key" ON "budgets"("workspaceId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "budget_lines_workspaceId_categoryId_idx" ON "budget_lines"("workspaceId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_lines_budgetId_categoryId_key" ON "budget_lines"("budgetId", "categoryId");

-- CreateIndex
CREATE INDEX "recurring_reminders_workspaceId_isActive_idx" ON "recurring_reminders"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "recurring_reminders_workspaceId_expectedDayOfMonth_idx" ON "recurring_reminders"("workspaceId", "expectedDayOfMonth");

-- CreateIndex
CREATE INDEX "accounts_workspaceId_type_status_idx" ON "accounts"("workspaceId", "type", "status");

-- CreateIndex
CREATE INDEX "accounts_workspaceId_includeInReports_idx" ON "accounts"("workspaceId", "includeInReports");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_workspaceId_id_key" ON "accounts"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "categories_workspaceId_kind_isActive_idx" ON "categories"("workspaceId", "kind", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "categories_workspaceId_id_key" ON "categories"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_workspaceId_key_key" ON "categories"("workspaceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "categories_workspaceId_parentId_name_kind_key" ON "categories"("workspaceId", "parentId", "name", "kind");

-- CreateIndex
CREATE INDEX "plan_change_logs_status_scheduledFor_idx" ON "plan_change_logs"("status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_providerSubscriptionId_key" ON "subscriptions"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_status_currentPeriodEnd_idx" ON "subscriptions"("status", "currentPeriodEnd");

-- CreateIndex
CREATE INDEX "subscriptions_status_gracePeriodEnd_idx" ON "subscriptions"("status", "gracePeriodEnd");

-- CreateIndex
CREATE INDEX "transactions_workspaceId_date_idx" ON "transactions"("workspaceId", "date");

-- CreateIndex
CREATE INDEX "transactions_accountId_date_idx" ON "transactions"("accountId", "date");

-- CreateIndex
CREATE INDEX "transactions_workspaceId_date_direction_idx" ON "transactions"("workspaceId", "date", "direction");

-- CreateIndex
CREATE INDEX "transactions_workspaceId_date_kind_idx" ON "transactions"("workspaceId", "date", "kind");

-- CreateIndex
CREATE INDEX "transactions_systemMerchantId_idx" ON "transactions"("systemMerchantId");

-- CreateIndex
CREATE INDEX "transactions_workspaceId_workspaceMerchantId_idx" ON "transactions"("workspaceId", "workspaceMerchantId");

-- CreateIndex
CREATE INDEX "transactions_workspaceId_sourceProvider_idx" ON "transactions"("workspaceId", "sourceProvider");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_workspaceId_id_key" ON "transactions"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_workspaceId_sourceDedupKey_key" ON "transactions"("workspaceId", "sourceDedupKey");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_workspaceId_sourceProvider_sourceExternalId_key" ON "transactions"("workspaceId", "sourceProvider", "sourceExternalId");

-- CreateIndex
CREATE INDEX "usage_records_workspaceId_featureCode_periodType_periodEnd_idx" ON "usage_records"("workspaceId", "featureCode", "periodType", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "usage_records_workspaceId_featureCode_periodType_periodStar_key" ON "usage_records"("workspaceId", "featureCode", "periodType", "periodStart");

-- CreateIndex
CREATE INDEX "workspace_memberships_workspaceId_role_status_idx" ON "workspace_memberships"("workspaceId", "role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_memberships_workspaceId_userId_key" ON "workspace_memberships"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "workspace_settings_baseCurrencyCode_idx" ON "workspace_settings"("baseCurrencyCode");

-- AddForeignKey
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_baseCurrencyCode_fkey" FOREIGN KEY ("baseCurrencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_user_preferences" ADD CONSTRAINT "workspace_user_preferences_workspaceId_userId_fkey" FOREIGN KEY ("workspaceId", "userId") REFERENCES "workspace_memberships"("workspaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_change_logs" ADD CONSTRAINT "plan_change_logs_fromPlanId_fkey" FOREIGN KEY ("fromPlanId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_change_logs" ADD CONSTRAINT "plan_change_logs_toPlanId_fkey" FOREIGN KEY ("toPlanId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_featureCode_fkey" FOREIGN KEY ("featureCode") REFERENCES "feature_definitions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_featureCode_fkey" FOREIGN KEY ("featureCode") REFERENCES "feature_definitions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_featureCode_fkey" FOREIGN KEY ("featureCode") REFERENCES "feature_definitions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_daily_balances" ADD CONSTRAINT "account_daily_balances_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_daily_balances" ADD CONSTRAINT "account_daily_balances_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_profiles" ADD CONSTRAINT "loan_profiles_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_profiles" ADD CONSTRAINT "credit_card_profiles_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_profiles" ADD CONSTRAINT "debt_profiles_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lent_money_profiles" ADD CONSTRAINT "lent_money_profiles_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_reconciliations" ADD CONSTRAINT "account_reconciliations_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_reconciliations" ADD CONSTRAINT "account_reconciliations_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_workspaceId_parentId_fkey" FOREIGN KEY ("workspaceId", "parentId") REFERENCES "categories"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_merchants" ADD CONSTRAINT "workspace_merchants_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_workspaceId_accountId_fkey" FOREIGN KEY ("workspaceId", "accountId") REFERENCES "accounts"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_workspaceId_categoryId_fkey" FOREIGN KEY ("workspaceId", "categoryId") REFERENCES "categories"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_systemMerchantId_fkey" FOREIGN KEY ("systemMerchantId") REFERENCES "system_merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_workspaceId_workspaceMerchantId_fkey" FOREIGN KEY ("workspaceId", "workspaceMerchantId") REFERENCES "workspace_merchants"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_workspaceId_transactionId_fkey" FOREIGN KEY ("workspaceId", "transactionId") REFERENCES "transactions"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_workspaceId_tagId_fkey" FOREIGN KEY ("workspaceId", "tagId") REFERENCES "tags"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_workspaceId_fromTransactionId_fkey" FOREIGN KEY ("workspaceId", "fromTransactionId") REFERENCES "transactions"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_workspaceId_toTransactionId_fkey" FOREIGN KEY ("workspaceId", "toTransactionId") REFERENCES "transactions"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_fromCurrencyCode_fkey" FOREIGN KEY ("fromCurrencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_toCurrencyCode_fkey" FOREIGN KEY ("toCurrencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_workspaceId_budgetId_fkey" FOREIGN KEY ("workspaceId", "budgetId") REFERENCES "budgets"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_workspaceId_categoryId_fkey" FOREIGN KEY ("workspaceId", "categoryId") REFERENCES "categories"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_reminders" ADD CONSTRAINT "recurring_reminders_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_reminders" ADD CONSTRAINT "recurring_reminders_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_reminders" ADD CONSTRAINT "recurring_reminders_workspaceId_categoryId_fkey" FOREIGN KEY ("workspaceId", "categoryId") REFERENCES "categories"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
