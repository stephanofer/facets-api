import { ApiProperty } from '@nestjs/swagger';
import {
  PlatformRole,
  ThemePreference,
  UserStatus,
  WorkspaceMembershipStatus,
  WorkspaceRole,
  WorkspaceStatus,
  WorkspaceType,
} from '@/generated/prisma/client';

export class AuthBootstrapUserDto {
  @ApiProperty({ example: 'cuid_123456789' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({ example: true })
  emailVerified: boolean;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({ enum: PlatformRole, example: PlatformRole.USER })
  platformRole: PlatformRole;

  @ApiProperty({ example: '2026-02-04T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({
    example: 'https://cdn.facets.test/avatars/avatar-123.webp',
    nullable: true,
  })
  avatarUrl: string | null;
}

export class AuthBootstrapWorkspaceDto {
  @ApiProperty({ example: 'cwksp_123456789' })
  id: string;

  @ApiProperty({ example: 'John Workspace' })
  name: string;

  @ApiProperty({ enum: WorkspaceType, example: WorkspaceType.PERSONAL })
  type: WorkspaceType;

  @ApiProperty({ enum: WorkspaceStatus, example: WorkspaceStatus.ACTIVE })
  status: WorkspaceStatus;
}

export class AuthBootstrapMembershipDto {
  @ApiProperty({ example: 'cmship_123456789' })
  id: string;

  @ApiProperty({ enum: WorkspaceRole, example: WorkspaceRole.ADMIN })
  role: WorkspaceRole;

  @ApiProperty({
    enum: WorkspaceMembershipStatus,
    example: WorkspaceMembershipStatus.ACTIVE,
  })
  status: WorkspaceMembershipStatus;
}

export class AuthBootstrapProfileDto {
  @ApiProperty({ example: 'AR', nullable: true })
  countryCode: string | null;

  @ApiProperty({
    enum: ThemePreference,
    example: ThemePreference.DARK,
    nullable: true,
  })
  theme: ThemePreference | null;

  @ApiProperty({ example: '2026-03-15T10:00:00.000Z', nullable: true })
  onboardingCompletedAt: Date | null;
}

export class AuthBootstrapWorkspaceSettingsDto {
  @ApiProperty({ example: 'USD' })
  baseCurrencyCode: string;

  @ApiProperty({ example: 'en-US' })
  contentLocale: string;

  @ApiProperty({ example: 'DD/MM/YYYY' })
  dateFormat: string;

  @ApiProperty({ example: 1 })
  monthStartDay: number;

  @ApiProperty({ example: 1 })
  weekStartDay: number;

  @ApiProperty({ example: 'UTC' })
  financialTimezone: string;
}

export class AuthBootstrapResponseDto {
  @ApiProperty({ type: AuthBootstrapUserDto })
  user: AuthBootstrapUserDto;

  @ApiProperty({ type: AuthBootstrapWorkspaceDto })
  workspace: AuthBootstrapWorkspaceDto;

  @ApiProperty({ type: AuthBootstrapMembershipDto })
  membership: AuthBootstrapMembershipDto;

  @ApiProperty({ type: AuthBootstrapProfileDto })
  profile: AuthBootstrapProfileDto;

  @ApiProperty({ type: AuthBootstrapWorkspaceSettingsDto })
  workspaceSettings: AuthBootstrapWorkspaceSettingsDto;

  @ApiProperty({ example: true })
  needsOnboarding: boolean;
}
