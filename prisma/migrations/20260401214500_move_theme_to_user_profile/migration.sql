-- Move theme ownership from workspace-scoped preferences to user-scoped profiles.
ALTER TABLE "user_profiles"
ADD COLUMN "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM';

WITH ranked_preferences AS (
  SELECT
    "wm"."userId",
    "wup"."theme",
    ROW_NUMBER() OVER (
      PARTITION BY "wm"."userId"
      ORDER BY "wm"."joinedAt" ASC NULLS LAST, "wm"."createdAt" ASC
    ) AS "rank"
  FROM "workspace_memberships" AS "wm"
  INNER JOIN "workspace_user_preferences" AS "wup"
    ON "wup"."workspaceId" = "wm"."workspaceId"
   AND "wup"."userId" = "wm"."userId"
  WHERE "wm"."status" = 'ACTIVE'
),
selected_preferences AS (
  SELECT
    "userId",
    "theme"
  FROM ranked_preferences
  WHERE "rank" = 1
)
INSERT INTO "user_profiles" (
  "id",
  "userId",
  "theme",
  "createdAt",
  "updatedAt"
)
SELECT
  substring(md5(selected_preferences."userId" || clock_timestamp()::text || random()::text), 1, 24),
  selected_preferences."userId",
  selected_preferences."theme",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM selected_preferences
LEFT JOIN "user_profiles" AS "existing_profile"
  ON "existing_profile"."userId" = selected_preferences."userId"
WHERE "existing_profile"."userId" IS NULL;

WITH ranked_preferences AS (
  SELECT
    "wm"."userId",
    "wup"."theme",
    ROW_NUMBER() OVER (
      PARTITION BY "wm"."userId"
      ORDER BY "wm"."joinedAt" ASC NULLS LAST, "wm"."createdAt" ASC
    ) AS "rank"
  FROM "workspace_memberships" AS "wm"
  INNER JOIN "workspace_user_preferences" AS "wup"
    ON "wup"."workspaceId" = "wm"."workspaceId"
   AND "wup"."userId" = "wm"."userId"
  WHERE "wm"."status" = 'ACTIVE'
),
selected_preferences AS (
  SELECT
    "userId",
    "theme"
  FROM ranked_preferences
  WHERE "rank" = 1
)
UPDATE "user_profiles" AS "up"
SET
  "theme" = selected_preferences."theme",
  "updatedAt" = CURRENT_TIMESTAMP
FROM selected_preferences
WHERE "up"."userId" = selected_preferences."userId";

ALTER TABLE "workspace_user_preferences" DROP COLUMN IF EXISTS "theme";
