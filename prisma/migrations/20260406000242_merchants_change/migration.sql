/*
  Warnings:

  - You are about to drop the column `systemMerchantId` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `workspaceMerchantId` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the `system_merchants` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workspace_merchants` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "MerchantSource" AS ENUM ('SYSTEM', 'CUSTOM');

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_systemMerchantId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_workspaceId_workspaceMerchantId_fkey";

-- DropForeignKey
ALTER TABLE "workspace_merchants" DROP CONSTRAINT "workspace_merchants_workspaceId_fkey";

-- DropIndex
DROP INDEX "transactions_systemMerchantId_idx";

-- DropIndex
DROP INDEX "transactions_workspaceId_workspaceMerchantId_idx";

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "systemMerchantId",
DROP COLUMN "workspaceMerchantId",
ADD COLUMN     "merchantId" TEXT;

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "avatarStorageKey" VARCHAR(500);

-- DropTable
DROP TABLE "system_merchants";

-- DropTable
DROP TABLE "workspace_merchants";

-- CreateTable
CREATE TABLE "system_merchant_catalog" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "normalizedName" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "logoUrl" VARCHAR(500),
    "color" VARCHAR(20),
    "websiteUrl" VARCHAR(500),
    "suggestedCategoryKey" VARCHAR(100),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_merchant_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "source" "MerchantSource" NOT NULL,
    "originSlug" VARCHAR(160),
    "name" VARCHAR(160) NOT NULL,
    "normalizedName" VARCHAR(160) NOT NULL,
    "logoUrl" VARCHAR(500),
    "color" VARCHAR(20),
    "suggestedCategoryKey" VARCHAR(100),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_merchant_catalog_isActive_idx" ON "system_merchant_catalog"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "system_merchant_catalog_normalizedName_key" ON "system_merchant_catalog"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "system_merchant_catalog_slug_key" ON "system_merchant_catalog"("slug");

-- CreateIndex
CREATE INDEX "merchants_workspaceId_isActive_idx" ON "merchants"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "merchants_workspaceId_source_idx" ON "merchants"("workspaceId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_workspaceId_id_key" ON "merchants"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_workspaceId_normalizedName_key" ON "merchants"("workspaceId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_workspaceId_originSlug_key" ON "merchants"("workspaceId", "originSlug");

-- CreateIndex
CREATE INDEX "transactions_workspaceId_merchantId_idx" ON "transactions"("workspaceId", "merchantId");

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_workspaceId_merchantId_fkey" FOREIGN KEY ("workspaceId", "merchantId") REFERENCES "merchants"("workspaceId", "id") ON DELETE SET NULL ON UPDATE CASCADE;
