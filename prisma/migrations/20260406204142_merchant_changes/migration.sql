/*
  Warnings:

  - You are about to drop the column `key` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `suggestedCategoryKey` on the `merchants` table. All the data in the column will be lost.
  - You are about to drop the column `suggestedCategoryKey` on the `system_merchant_catalog` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "categories_workspaceId_key_key";

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "key";

-- AlterTable
ALTER TABLE "merchants" DROP COLUMN "suggestedCategoryKey";

-- AlterTable
ALTER TABLE "system_merchant_catalog" DROP COLUMN "suggestedCategoryKey";
