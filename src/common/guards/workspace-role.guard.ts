import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { PLATFORM_ROLE_KEY } from '@common/decorators/platform-role.decorator';
import { WORKSPACE_ROLE_KEY } from '@common/decorators/workspace-role.decorator';
import { ERROR_CODES } from '@common/constants/app.constants';
import { BusinessException } from '@common/exceptions/business.exception';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import {
  WorkspaceMembershipStatus,
  WorkspaceRole,
} from '../../generated/prisma/client';

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.isPublicRoute(context) || this.isPlatformRoute(context)) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      WORKSPACE_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
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

    if (principal.membership?.status !== WorkspaceMembershipStatus.ACTIVE) {
      throw new BusinessException(
        ERROR_CODES.FORBIDDEN,
        'Active workspace membership required',
        HttpStatus.FORBIDDEN,
      );
    }

    if (
      principal.workspaceRole !== principal.membership.role ||
      !requiredRoles.includes(principal.workspaceRole)
    ) {
      throw new BusinessException(
        ERROR_CODES.FORBIDDEN,
        'Insufficient workspace role for this route',
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
