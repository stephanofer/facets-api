-- Preserve the user-facing workspace name before removing the duplicate settings label.
UPDATE "workspaces" AS w
SET "name" = ws."displayLabel"
FROM "workspace_settings" AS ws
WHERE ws."workspaceId" = w."id"
  AND ws."displayLabel" IS NOT NULL
  AND ws."displayLabel" <> ''
  AND w."name" <> ws."displayLabel";

ALTER TABLE "workspace_settings" DROP COLUMN IF EXISTS "displayLabel";
