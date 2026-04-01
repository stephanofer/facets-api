import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { PLATFORM_ROLE_KEY } from '@common/decorators/platform-role.decorator';
import { BusinessException } from '@common/exceptions/business.exception';
import { ActiveMembershipGuard } from '@common/guards/active-membership.guard';
import {
  PlatformRole,
  WorkspaceMembershipStatus,
  WorkspaceRole,
  WorkspaceStatus,
  WorkspaceType,
} from '@/generated/prisma/client';

describe('ActiveMembershipGuard', () => {
  let reflector: jest.Mocked<Reflector>;
  let guard: ActiveMembershipGuard;

  const createPrincipal = () => ({
    sub: 'user-1',
    email: 'user@example.com',
    workspaceId: 'workspace-1',
    membershipId: 'membership-1',
    workspaceRole: WorkspaceRole.ADMIN,
    platformRole: PlatformRole.USER,
    user: {
      id: 'user-1',
      email: 'user@example.com',
      platformRole: PlatformRole.USER,
    },
    workspace: {
      id: 'workspace-1',
      name: 'Workspace',
      type: WorkspaceType.PERSONAL,
      status: WorkspaceStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    membership: {
      id: 'membership-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role: WorkspaceRole.ADMIN,
      status: WorkspaceMembershipStatus.ACTIVE,
      joinedAt: new Date(),
      invitedByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const createContext = (user?: unknown): ExecutionContext => {
    const handler = jest.fn();
    class TestController {}

    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => handler,
      getClass: () => TestController,
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    reflector.getAllAndOverride.mockImplementation((metadataKey: string) => {
      if (metadataKey === IS_PUBLIC_KEY) {
        return false;
      }

      if (metadataKey === PLATFORM_ROLE_KEY) {
        return undefined;
      }

      return undefined;
    });

    guard = new ActiveMembershipGuard(reflector);
  });

  it('allows requests with an active membership and active workspace', () => {
    expect(guard.canActivate(createContext(createPrincipal()))).toBe(true);
  });

  it('rejects requests without a hydrated principal', () => {
    expect(() => guard.canActivate(createContext())).toThrow(BusinessException);

    try {
      guard.canActivate(createContext());
    } catch (error) {
      const exception = error as BusinessException;
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    }
  });

  it('rejects requests with inactive membership data', () => {
    const principal = createPrincipal() as any;
    principal.membership.status = WorkspaceMembershipStatus.SUSPENDED;

    expect(() => guard.canActivate(createContext(principal))).toThrow(
      BusinessException,
    );
  });

  it('skips membership enforcement on explicit platform routes', () => {
    reflector.getAllAndOverride.mockImplementation((metadataKey: string) => {
      if (metadataKey === IS_PUBLIC_KEY) {
        return false;
      }

      if (metadataKey === PLATFORM_ROLE_KEY) {
        return [PlatformRole.SUPER_ADMIN];
      }

      return undefined;
    });

    expect(guard.canActivate(createContext())).toBe(true);
  });
});
