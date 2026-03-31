import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { PLATFORM_ROLE_KEY } from '@common/decorators/platform-role.decorator';
import { BusinessException } from '@common/exceptions/business.exception';
import { PlatformRoleGuard } from '@common/guards/platform-role.guard';
import { PlatformRole } from '@/generated/prisma/client';

describe('PlatformRoleGuard', () => {
  let reflector: jest.Mocked<Reflector>;
  let guard: PlatformRoleGuard;

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
        return [PlatformRole.SUPER_ADMIN];
      }

      return undefined;
    });

    guard = new PlatformRoleGuard(reflector);
  });

  it('allows explicit super-admin routes for super admins', () => {
    const principal = {
      platformRole: PlatformRole.SUPER_ADMIN,
      user: {
        platformRole: PlatformRole.SUPER_ADMIN,
      },
    };

    expect(guard.canActivate(createContext(principal))).toBe(true);
  });

  it('rejects non-super-admin principals on platform routes', () => {
    const principal = {
      platformRole: PlatformRole.USER,
      user: {
        platformRole: PlatformRole.USER,
      },
    };

    expect(() => guard.canActivate(createContext(principal))).toThrow(
      BusinessException,
    );

    try {
      guard.canActivate(createContext(principal));
    } catch (error) {
      const exception = error as BusinessException;
      expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });

  it('allows routes without platform role metadata', () => {
    reflector.getAllAndOverride.mockImplementation((metadataKey: string) => {
      if (metadataKey === IS_PUBLIC_KEY) {
        return false;
      }

      if (metadataKey === PLATFORM_ROLE_KEY) {
        return undefined;
      }

      return undefined;
    });

    expect(guard.canActivate(createContext())).toBe(true);
  });
});
