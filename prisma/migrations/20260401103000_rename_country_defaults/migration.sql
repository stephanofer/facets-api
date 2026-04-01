-- Rename country metadata columns to make default semantics explicit.
ALTER TABLE "countries" RENAME COLUMN "currencyCode" TO "defaultCurrencyCode";
ALTER TABLE "countries" RENAME COLUMN "phoneCode" TO "callingCode";
ALTER TABLE "countries" RENAME COLUMN "locale" TO "defaultLocale";

-- Keep room for longer BCP 47 locale tags.
ALTER TABLE "countries" ALTER COLUMN "defaultLocale" TYPE VARCHAR(20);

-- Align generated object names with the renamed column.
ALTER INDEX "countries_currencyCode_idx" RENAME TO "countries_defaultCurrencyCode_idx";
ALTER TABLE "countries" RENAME CONSTRAINT "countries_currencyCode_fkey" TO "countries_defaultCurrencyCode_fkey";
