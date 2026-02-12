-- CreateEnum
CREATE TYPE "PreferenceCategory" AS ENUM ('DASHBOARD', 'APPEARANCE', 'NOTIFICATIONS', 'PRIVACY', 'REGIONAL', 'TRANSACTIONS');

-- CreateEnum
CREATE TYPE "PreferenceDataType" AS ENUM ('BOOLEAN', 'STRING', 'NUMBER', 'JSON', 'STRING_ARRAY');

-- CreateTable
CREATE TABLE "currencies" (
    "code" VARCHAR(3) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "decimalScale" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "countries" (
    "code" VARCHAR(2) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "phoneCode" VARCHAR(10) NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en-US',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" VARCHAR(20),
    "avatarUrl" VARCHAR(500),
    "countryCode" VARCHAR(2),
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en-US',
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preference_definitions" (
    "id" TEXT NOT NULL,
    "category" "PreferenceCategory" NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "dataType" "PreferenceDataType" NOT NULL,
    "defaultValue" JSONB NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "preference_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferenceId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "currencies_isActive_idx" ON "currencies"("isActive");

-- CreateIndex
CREATE INDEX "countries_isActive_idx" ON "countries"("isActive");

-- CreateIndex
CREATE INDEX "countries_currencyCode_idx" ON "countries"("currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE INDEX "user_profiles_countryCode_idx" ON "user_profiles"("countryCode");

-- CreateIndex
CREATE INDEX "user_profiles_currencyCode_idx" ON "user_profiles"("currencyCode");

-- CreateIndex
CREATE INDEX "preference_definitions_category_isActive_idx" ON "preference_definitions"("category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "preference_definitions_category_key_key" ON "preference_definitions"("category", "key");

-- CreateIndex
CREATE INDEX "user_preferences_userId_idx" ON "user_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_preferenceId_key" ON "user_preferences"("userId", "preferenceId");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "countries"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_preferenceId_fkey" FOREIGN KEY ("preferenceId") REFERENCES "preference_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
