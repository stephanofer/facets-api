/**
 * Workspace is the tenant and authorization boundary.
 *
 * Services and repositories MUST accept `workspaceId` explicitly in their
 * query/write contracts for tenant-owned resources instead of relying on
 * `userId` as a pseudo-tenant shortcut.
 */
export interface WorkspaceBoundary {
  workspaceId: string;
}

/**
 * Use when business writes need both tenant scope and actor identity.
 */
export interface WorkspaceActorBoundary extends WorkspaceBoundary {
  actorUserId: string;
}
