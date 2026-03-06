/*
  Warnings:

  - You are about to drop the column `attachments` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `avatarUrl` on the `user_profiles` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[avatarFileId]` on the table `user_profiles` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "FilePurpose" AS ENUM ('AVATAR', 'TRANSACTION_RECEIPT');

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "attachments";

-- AlterTable
ALTER TABLE "user_profiles" DROP COLUMN "avatarUrl",
ADD COLUMN     "avatarFileId" TEXT;

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "FilePurpose" NOT NULL,
    "bucket" VARCHAR(100) NOT NULL,
    "key" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "publicUrl" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "transactionId" TEXT,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "files_userId_idx" ON "files"("userId");

-- CreateIndex
CREATE INDEX "files_userId_purpose_idx" ON "files"("userId", "purpose");

-- CreateIndex
CREATE INDEX "files_transactionId_idx" ON "files"("transactionId");

-- CreateIndex
CREATE INDEX "files_deletedAt_idx" ON "files"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "files_bucket_key_key" ON "files"("bucket", "key");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_avatarFileId_key" ON "user_profiles"("avatarFileId");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_avatarFileId_fkey" FOREIGN KEY ("avatarFileId") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
