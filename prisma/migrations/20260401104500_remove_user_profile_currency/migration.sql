-- User profile should not define financial currency truth.
ALTER TABLE "user_profiles" DROP CONSTRAINT IF EXISTS "user_profiles_currencyCode_fkey";
ALTER TABLE "user_profiles" DROP COLUMN IF EXISTS "currencyCode";
