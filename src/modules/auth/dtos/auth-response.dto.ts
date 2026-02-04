import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * JWT Payload structure for access tokens
 */
export interface JwtPayload {
  /** User's unique identifier */
  sub: string;
  /** User's email */
  email: string;
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

/**
 * Simplified plan info for auth responses
 */
export class AuthPlanDto {
  @ApiProperty({
    description: 'Plan code',
    example: 'free',
  })
  code: string;

  @ApiProperty({
    description: 'Plan display name',
    example: 'Free',
  })
  name: string;
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
    type: AuthPlanDto,
    description: 'Current subscription plan',
  })
  plan?: AuthPlanDto;
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

/**
 * Reset code verification response - returns temporary reset token
 */
export class VerifyResetCodeResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Code verified. You can now reset your password.',
  })
  message: string;

  @ApiProperty({
    description: 'Whether the code is valid',
    example: true,
  })
  valid: boolean;
}
