# Workspace-first Batch 1 notes

## Scope

This note documents the schema pivot introduced in Batch 1 for `workspace-first-architecture`.

## Important operational rule

- Prisma migration commands were intentionally NOT executed in this batch.
- Do not run `prisma migrate`, `prisma db push`, or equivalent automatic schema sync as part of this implementation flow.
- The user will apply database changes manually.

## Destructive baseline expectation

This schema is a workspace-first baseline, not a backwards-compatible bridge.

- Business ownership moved from `userId` to `workspaceId` for tenant resources.
- `Workspace`, `WorkspaceMembership`, and `WorkspaceSettings` are now part of the domain truth.
- Local and test databases should be treated as reset/baseline candidates when the user later executes manual migration work.

## Constraint notes

### Single active admin per workspace

The schema expresses this using a partial unique constraint on `WorkspaceMembership`:

- one active membership per `(workspaceId, userId)`
- one active `ADMIN` membership per `workspaceId`

This relies on Prisma partial indexes preview support. If the final manual migration workflow cannot materialize the exact constraint shape automatically, create the equivalent PostgreSQL partial unique indexes manually during the user-controlled migration step.

### Category uniqueness with nullable `parentId`

PostgreSQL unique constraints treat `NULL` values as distinct, so top-level and child category uniqueness were split into separate partial unique constraints.

That avoids the classic nullable-parent loophole for:

- system top-level categories
- system child categories
- workspace top-level categories
- workspace child categories

## Follow-up batches

Later batches align auth, guards, subscriptions services, repositories, controllers, tests, and docs with this schema truth.

At the current repo state, the remaining gap is NOT a general user-scoped runtime model anymore. The residual scope is limited to batches that depend on aggregates that still do not exist as implemented Nest modules in this repository.
