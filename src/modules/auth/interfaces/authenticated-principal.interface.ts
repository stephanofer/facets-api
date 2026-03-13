import { JwtPayload } from '@modules/auth/dtos/auth-response.dto';
import { WorkspaceActorBoundary } from '@common/interfaces/workspace-boundary.interface';
import {
  User,
  Workspace,
  WorkspaceMembership,
} from '../../../generated/prisma/client';

export interface AuthenticatedPrincipal
  extends JwtPayload, WorkspaceActorBoundary {
  user: User;
  workspace: Workspace;
  membership: WorkspaceMembership;
}

// Transitional alias while the rest of the app migrates.
export type AuthenticatedUser = AuthenticatedPrincipal;
