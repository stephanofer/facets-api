import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PlatformRole,
  WorkspaceMembershipStatus,
  WorkspaceRole,
  WorkspaceStatus,
  WorkspaceType,
} from '@/generated/prisma/client';

/**
 * JWT Payload structure for access tokens
 */
export interface JwtPayload {
  /** User's unique identifier */
  sub: string;
  /** User's email */
  email: string;
  /** Active workspace identifier */
  workspaceId: string;
  /** Active membership identifier */
  membershipId: string;
  /** Active workspace role */
  workspaceRole: WorkspaceRole;
  /** Global platform role */
  platformRole: PlatformRole;
  /** Issued at timestamp */
  iat?: number;
  /** Expiration timestamp */
  exp?: number;
}

/**
 * JWT Payload structure for refresh tokens
 */
export interface RefreshTokenPayload extends JwtPayload {
  /** Token ID for revocation tracking */
  tokenId: string;
}

/**
 * Authentication tokens response
 */
export class TokensResponseDto {
  @ApiProperty({
    description: 'JWT access token for API authentication',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Refresh token for obtaining new access tokens',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Access token expiration time in seconds',
    example: 3600,
  })
  expiresIn: number;
}

export class AuthWorkspaceDto {
  @ApiProperty({
    description: 'Workspace unique identifier',
    example: 'cwksp_123456789',
  })
  id: string;

  @ApiProperty({
    description: 'Workspace display name',
    example: 'John Workspace',
  })
  name: string;

  @ApiProperty({
    description: 'Workspace type',
    enum: WorkspaceType,
    example: WorkspaceType.PERSONAL,
  })
  type: WorkspaceType;

  @ApiProperty({
    description: 'Workspace status',
    enum: WorkspaceStatus,
    example: WorkspaceStatus.ACTIVE,
  })
  status: WorkspaceStatus;
}

export class AuthMembershipDto {
  @ApiProperty({
    description: 'Workspace membership unique identifier',
    example: 'cmbr_123456789',
  })
  id: string;

  @ApiProperty({
    description: 'Role inside the current workspace',
    enum: WorkspaceRole,
    example: WorkspaceRole.ADMIN,
  })
  role: WorkspaceRole;

  @ApiProperty({
    description: 'Membership status inside the current workspace',
    enum: WorkspaceMembershipStatus,
    example: WorkspaceMembershipStatus.ACTIVE,
  })
  status: WorkspaceMembershipStatus;
}

/**
 * User information included in auth responses
 */
export class AuthUserDto {
  @ApiProperty({
    description: 'User unique identifier',
    example: 'cuid_123456789',
  })
  id: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  lastName: string;

  @ApiProperty({
    description: 'Whether the email has been verified',
    example: true,
  })
  emailVerified: boolean;

  @ApiProperty({
    description: 'User account status',
    example: 'ACTIVE',
    enum: ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DELETED'],
  })
  status: string;

  @ApiProperty({
    description: 'Account creation date',
    example: '2026-02-04T12:00:00.000Z',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Current user avatar public URL',
    example: 'https://cdn.facets.test/avatars/avatar-123.webp',
  })
  avatarUrl?: string;

  @ApiProperty({
    type: AuthWorkspaceDto,
    description: 'Current active workspace summary',
  })
  workspace: AuthWorkspaceDto;

  @ApiProperty({
    type: AuthMembershipDto,
    description: 'Current active workspace membership summary',
  })
  membership: AuthMembershipDto;

  @ApiProperty({
    description: 'Global platform role',
    enum: PlatformRole,
    example: PlatformRole.USER,
  })
  platformRole: PlatformRole;
}

/**
 * Login response with tokens and user info
 */
export class LoginResponseDto {
  @ApiProperty({ type: TokensResponseDto })
  tokens: TokensResponseDto;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}

/**
 * Registration response
 */
export class RegisterResponseDto {
  @ApiProperty({
    description: 'Success message',
    example:
      'Registration successful. Please check your email to verify your account.',
  })
  message: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}

/**
 * Simple message response
 */
export class MessageResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Operation completed successfully',
  })
  message: string;
}

/**
 * Email verification response - includes tokens for auto-login
 */
export class VerifyEmailResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Email verified successfully',
  })
  message: string;

  @ApiProperty({ type: TokensResponseDto })
  tokens: TokensResponseDto;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}
