import { SetMetadata } from '@nestjs/common';
import { PlatformRole } from '@/generated/prisma/client';

export const PLATFORM_ROLE_KEY = 'platformRoles';

export const RequirePlatformRole = (...roles: PlatformRole[]) =>
  SetMetadata(PLATFORM_ROLE_KEY, roles);

export const SuperAdminOnly = () =>
  RequirePlatformRole(PlatformRole.SUPER_ADMIN);
