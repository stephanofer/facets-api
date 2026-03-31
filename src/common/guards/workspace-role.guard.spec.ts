import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { PLATFORM_ROLE_KEY } from '@common/decorators/platform-role.decorator';
import { WORKSPACE_ROLE_KEY } from '@common/decorators/workspace-role.decorator';
import { BusinessException } from '@common/exceptions/business.exception';
import { WorkspaceRoleGuard } from '@common/guards/workspace-role.guard';
import {
  PlatformRole,
  WorkspaceMembershipStatus,
  WorkspaceRole,
} from '@/generated/prisma/client';

describe('WorkspaceRoleGuard', () => {
  let reflector: jest.Mocked<Reflector>;
  let guard: WorkspaceRoleGuard;

  const createPrincipal = (
    workspaceRole: WorkspaceRole = WorkspaceRole.ADMIN,
  ) => ({
    sub: 'user-1',
    email: 'user@example.com',
    workspaceId: 'workspace-1',
    membershipId: 'membership-1',
    workspaceRole,
    platformRole: PlatformRole.USER,
    user: {
      id: 'user-1',
      email: 'user@example.com',
      platformRole: PlatformRole.USER,
    },
    membership: {
      id: 'membership-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role: workspaceRole,
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

      if (metadataKey === WORKSPACE_ROLE_KEY) {
        return [WorkspaceRole.ADMIN];
      }

      return undefined;
    });

    guard = new WorkspaceRoleGuard(reflector);
  });

  it('allows requests when the membership role matches the required role', () => {
    expect(guard.canActivate(createContext(createPrincipal()))).toBe(true);
  });

  it('rejects requests with insufficient workspace role', () => {
    expect(() =>
      guard.canActivate(createContext(createPrincipal(WorkspaceRole.MEMBER))),
    ).toThrow(BusinessException);

    try {
      guard.canActivate(createContext(createPrincipal(WorkspaceRole.MEMBER)));
    } catch (error) {
      const exception = error as BusinessException;
      expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });

  it('allows requests when no workspace role metadata is present', () => {
    reflector.getAllAndOverride.mockImplementation((metadataKey: string) => {
      if (metadataKey === IS_PUBLIC_KEY) {
        return false;
      }

      if (metadataKey === PLATFORM_ROLE_KEY) {
        return undefined;
      }

      if (metadataKey === WORKSPACE_ROLE_KEY) {
        return undefined;
      }

      return undefined;
    });

    expect(
      guard.canActivate(createContext(createPrincipal(WorkspaceRole.GUEST))),
    ).toBe(true);
  });

  it('skips tenant role checks on explicit platform routes', () => {
    reflector.getAllAndOverride.mockImplementation((metadataKey: string) => {
      if (metadataKey === IS_PUBLIC_KEY) {
        return false;
      }

      if (metadataKey === PLATFORM_ROLE_KEY) {
        return [PlatformRole.SUPER_ADMIN];
      }

      if (metadataKey === WORKSPACE_ROLE_KEY) {
        return [WorkspaceRole.ADMIN];
      }

      return undefined;
    });

    expect(guard.canActivate(createContext())).toBe(true);
  });
});
