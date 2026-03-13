import { SetMetadata } from '@nestjs/common';
import { WorkspaceRole } from '../../generated/prisma/client';

export const WORKSPACE_ROLE_KEY = 'workspaceRoles';

export const RequireWorkspaceRole = (...roles: WorkspaceRole[]) =>
  SetMetadata(WORKSPACE_ROLE_KEY, roles);
