import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { PLATFORM_ROLE_KEY } from '@common/decorators/platform-role.decorator';
import { ERROR_CODES } from '@common/constants/app.constants';
import { BusinessException } from '@common/exceptions/business.exception';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import {
  WorkspaceMembershipStatus,
  WorkspaceStatus,
} from '../../generated/prisma/client';

@Injectable()
export class ActiveMembershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.isPublicRoute(context) || this.isPlatformRoute(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const principal = request.user as AuthenticatedPrincipal | undefined;

    if (!principal) {
      throw new BusinessException(
        ERROR_CODES.UNAUTHORIZED,
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const membership = principal.membership;
    const workspace = principal.workspace;

    const membershipIsActive =
      membership?.status === WorkspaceMembershipStatus.ACTIVE;
    const workspaceIsActive = workspace?.status === WorkspaceStatus.ACTIVE;
    const tokenMatchesHydratedPrincipal =
      principal.sub === principal.user?.id &&
      principal.workspaceId === workspace?.id &&
      principal.workspaceId === membership?.workspaceId &&
      principal.membershipId === membership?.id;

    if (
      !membershipIsActive ||
      !workspaceIsActive ||
      !tokenMatchesHydratedPrincipal
    ) {
      throw new BusinessException(
        ERROR_CODES.FORBIDDEN,
        'Active workspace membership required',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  }

  private isPlatformRoute(context: ExecutionContext): boolean {
    const platformRoles = this.reflector.getAllAndOverride<string[]>(
      PLATFORM_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    return Boolean(platformRoles?.length);
  }
}
