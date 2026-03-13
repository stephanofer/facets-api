/*
  Warnings:

  - You are about to drop the column `userId` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `debt_payments` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `debts` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `files` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `goal_contributions` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `goals` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `loan_payments` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `loans` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `plan_change_logs` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `recurring_payments` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `usage_records` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name,type]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,type,parentId]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspaceId,name,type]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspaceId,name,type,parentId]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspaceId]` on the table `subscriptions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspaceId,featureCode,periodStart]` on the table `usage_records` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `workspaceId` to the `accounts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `debt_payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `debts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `files` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `goal_contributions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `goals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `loan_payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `loans` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `plan_change_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `recurring_payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `subscriptions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `usage_records` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('USER', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('ADMIN', 'MEMBER', 'GUEST');

-- CreateEnum
CREATE TYPE "WorkspaceMembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "WorkspaceType" AS ENUM ('PERSONAL', 'FAMILY', 'GROUP');

-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_userId_fkey";

-- DropForeignKey
ALTER TABLE "categories" DROP CONSTRAINT "categories_userId_fkey";

-- DropForeignKey
ALTER TABLE "debt_payments" DROP CONSTRAINT "debt_payments_userId_fkey";

-- DropForeignKey
ALTER TABLE "debts" DROP CONSTRAINT "debts_userId_fkey";

-- DropForeignKey
ALTER TABLE "files" DROP CONSTRAINT "files_userId_fkey";

-- DropForeignKey
ALTER TABLE "goal_contributions" DROP CONSTRAINT "goal_contributions_userId_fkey";

-- DropForeignKey
ALTER TABLE "goals" DROP CONSTRAINT "goals_userId_fkey";

-- DropForeignKey
ALTER TABLE "loan_payments" DROP CONSTRAINT "loan_payments_userId_fkey";

-- DropForeignKey
ALTER TABLE "loans" DROP CONSTRAINT "loans_userId_fkey";

-- DropForeignKey
ALTER TABLE "plan_change_logs" DROP CONSTRAINT "plan_change_logs_userId_fkey";

-- DropForeignKey
ALTER TABLE "recurring_payments" DROP CONSTRAINT "recurring_payments_userId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_userId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_userId_fkey";

-- DropForeignKey
ALTER TABLE "usage_records" DROP CONSTRAINT "usage_records_userId_fkey";

-- DropIndex
DROP INDEX "accounts_userId_currencyCode_idx";

-- DropIndex
DROP INDEX "accounts_userId_isArchived_idx";

-- DropIndex
DROP INDEX "accounts_userId_type_idx";

-- DropIndex
DROP INDEX "categories_userId_name_type_parentId_key";

-- DropIndex
DROP INDEX "categories_userId_type_isActive_idx";

-- DropIndex
DROP INDEX "debt_payments_userId_paidAt_idx";

-- DropIndex
DROP INDEX "debts_userId_direction_status_idx";

-- DropIndex
DROP INDEX "debts_userId_dueDate_idx";

-- DropIndex
DROP INDEX "debts_userId_status_idx";

-- DropIndex
DROP INDEX "files_userId_idx";

-- DropIndex
DROP INDEX "files_userId_purpose_idx";

-- DropIndex
DROP INDEX "goal_contributions_userId_date_idx";

-- DropIndex
DROP INDEX "goals_userId_status_idx";

-- DropIndex
DROP INDEX "goals_userId_targetDate_idx";

-- DropIndex
DROP INDEX "loan_payments_userId_dueDate_idx";

-- DropIndex
DROP INDEX "loan_payments_userId_paidAt_idx";

-- DropIndex
DROP INDEX "loans_userId_direction_status_idx";

-- DropIndex
DROP INDEX "loans_userId_nextPaymentDate_idx";

-- DropIndex
DROP INDEX "loans_userId_status_idx";

-- DropIndex
DROP INDEX "plan_change_logs_createdAt_idx";

-- DropIndex
DROP INDEX "plan_change_logs_userId_idx";

-- DropIndex
DROP INDEX "recurring_payments_userId_status_idx";

-- DropIndex
DROP INDEX "recurring_payments_userId_type_status_idx";

-- DropIndex
DROP INDEX "subscriptions_userId_idx";

-- DropIndex
DROP INDEX "subscriptions_userId_key";

-- DropIndex
DROP INDEX "transactions_userId_accountId_date_idx";

-- DropIndex
DROP INDEX "transactions_userId_categoryId_date_idx";

-- DropIndex
DROP INDEX "transactions_userId_date_idx";

-- DropIndex
DROP INDEX "transactions_userId_type_date_idx";

-- DropIndex
DROP INDEX "usage_records_userId_featureCode_idx";

-- DropIndex
DROP INDEX "usage_records_userId_featureCode_periodStart_key";

-- AlterTable
ALTER TABLE "accounts" DROP COLUMN "userId",
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "updatedByUserId" TEXT,
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "userId",
ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "debt_payments" DROP COLUMN "userId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "debts" DROP COLUMN "userId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "files" DROP COLUMN "userId",
ADD COLUMN     "uploadedByUserId" TEXT,
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "goal_contributions" DROP COLUMN "userId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "goals" DROP COLUMN "userId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "loan_payments" DROP COLUMN "userId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "loans" DROP COLUMN "userId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "plan_change_logs" DROP COLUMN "userId",
ADD COLUMN     "requestedByUserId" TEXT,
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "recurring_payments" DROP COLUMN "userId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "userId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "userId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "usage_records" DROP COLUMN "userId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120),
    "type" "WorkspaceType" NOT NULL DEFAULT 'PERSONAL',
    "status" "WorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_memberships" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "status" "WorkspaceMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_settings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "baseCurrencyCode" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "baseLanguage" VARCHAR(10) NOT NULL DEFAULT 'en',
    "dateFormat" VARCHAR(30) NOT NULL DEFAULT 'DD/MM/YYYY',
    "monthStartDay" INTEGER NOT NULL DEFAULT 1,
    "weekStartDay" INTEGER NOT NULL DEFAULT 1,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en-US',
    "displayLabel" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspaces_status_idx" ON "workspaces"("status");

-- CreateIndex
CREATE INDEX "workspaces_type_status_idx" ON "workspaces"("type", "status");

-- CreateIndex
CREATE INDEX "workspace_memberships_workspaceId_status_idx" ON "workspace_memberships"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "workspace_memberships_userId_status_idx" ON "workspace_memberships"("userId", "status");

-- CreateIndex
CREATE INDEX "workspace_memberships_invitedByUserId_idx" ON "workspace_memberships"("invitedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_memberships_workspaceId_userId_key" ON "workspace_memberships"("workspaceId", "userId") WHERE ("status" = 'ACTIVE');

-- CreateIndex
CREATE UNIQUE INDEX "workspace_memberships_workspaceId_key" ON "workspace_memberships"("workspaceId") WHERE ("role" = 'ADMIN' AND "status" = 'ACTIVE');

-- CreateIndex
CREATE UNIQUE INDEX "workspace_settings_workspaceId_key" ON "workspace_settings"("workspaceId");

-- CreateIndex
CREATE INDEX "accounts_workspaceId_isArchived_idx" ON "accounts"("workspaceId", "isArchived");

-- CreateIndex
CREATE INDEX "accounts_workspaceId_type_idx" ON "accounts"("workspaceId", "type");

-- CreateIndex
CREATE INDEX "accounts_workspaceId_currencyCode_idx" ON "accounts"("workspaceId", "currencyCode");

-- CreateIndex
CREATE INDEX "accounts_createdByUserId_idx" ON "accounts"("createdByUserId");

-- CreateIndex
CREATE INDEX "accounts_updatedByUserId_idx" ON "accounts"("updatedByUserId");

-- CreateIndex
CREATE INDEX "categories_workspaceId_type_isActive_idx" ON "categories"("workspaceId", "type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_type_key" ON "categories"("name", "type") WHERE ("isSystem" = true AND "parentId" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_type_parentId_key" ON "categories"("name", "type", "parentId") WHERE ("isSystem" = true AND "parentId" IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "categories_workspaceId_name_type_key" ON "categories"("workspaceId", "name", "type") WHERE ("isSystem" = false AND "parentId" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "categories_workspaceId_name_type_parentId_key" ON "categories"("workspaceId", "name", "type", "parentId") WHERE ("isSystem" = false AND "parentId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "debt_payments_workspaceId_paidAt_idx" ON "debt_payments"("workspaceId", "paidAt" DESC);

-- CreateIndex
CREATE INDEX "debts_workspaceId_status_idx" ON "debts"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "debts_workspaceId_direction_status_idx" ON "debts"("workspaceId", "direction", "status");

-- CreateIndex
CREATE INDEX "debts_workspaceId_dueDate_idx" ON "debts"("workspaceId", "dueDate");

-- CreateIndex
CREATE INDEX "files_workspaceId_idx" ON "files"("workspaceId");

-- CreateIndex
CREATE INDEX "files_workspaceId_purpose_idx" ON "files"("workspaceId", "purpose");

-- CreateIndex
CREATE INDEX "files_uploadedByUserId_idx" ON "files"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "goal_contributions_workspaceId_date_idx" ON "goal_contributions"("workspaceId", "date" DESC);

-- CreateIndex
CREATE INDEX "goals_workspaceId_status_idx" ON "goals"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "goals_workspaceId_targetDate_idx" ON "goals"("workspaceId", "targetDate");

-- CreateIndex
CREATE INDEX "loan_payments_workspaceId_dueDate_idx" ON "loan_payments"("workspaceId", "dueDate");

-- CreateIndex
CREATE INDEX "loan_payments_workspaceId_paidAt_idx" ON "loan_payments"("workspaceId", "paidAt" DESC);

-- CreateIndex
CREATE INDEX "loans_workspaceId_status_idx" ON "loans"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "loans_workspaceId_direction_status_idx" ON "loans"("workspaceId", "direction", "status");

-- CreateIndex
CREATE INDEX "loans_workspaceId_nextPaymentDate_idx" ON "loans"("workspaceId", "nextPaymentDate");

-- CreateIndex
CREATE INDEX "plan_change_logs_workspaceId_idx" ON "plan_change_logs"("workspaceId");

-- CreateIndex
CREATE INDEX "plan_change_logs_workspaceId_createdAt_idx" ON "plan_change_logs"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "plan_change_logs_requestedByUserId_idx" ON "plan_change_logs"("requestedByUserId");

-- CreateIndex
CREATE INDEX "recurring_payments_workspaceId_status_idx" ON "recurring_payments"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "recurring_payments_workspaceId_type_status_idx" ON "recurring_payments"("workspaceId", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_workspaceId_key" ON "subscriptions"("workspaceId");

-- CreateIndex
CREATE INDEX "subscriptions_workspaceId_idx" ON "subscriptions"("workspaceId");

-- CreateIndex
CREATE INDEX "transactions_workspaceId_date_idx" ON "transactions"("workspaceId", "date" DESC);

-- CreateIndex
CREATE INDEX "transactions_workspaceId_accountId_date_idx" ON "transactions"("workspaceId", "accountId", "date" DESC);

-- CreateIndex
CREATE INDEX "transactions_workspaceId_type_date_idx" ON "transactions"("workspaceId", "type", "date" DESC);

-- CreateIndex
CREATE INDEX "transactions_workspaceId_categoryId_date_idx" ON "transactions"("workspaceId", "categoryId", "date" DESC);

-- CreateIndex
CREATE INDEX "usage_records_workspaceId_featureCode_idx" ON "usage_records"("workspaceId", "featureCode");

-- CreateIndex
CREATE UNIQUE INDEX "usage_records_workspaceId_featureCode_periodStart_key" ON "usage_records"("workspaceId", "featureCode", "periodStart");

-- AddForeignKey
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_change_logs" ADD CONSTRAINT "plan_change_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_change_logs" ADD CONSTRAINT "plan_change_logs_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
