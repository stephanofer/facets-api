import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '@modules/auth/auth.service';
import { RegisterDto } from '@modules/auth/dtos/register.dto';
import { LoginDto } from '@modules/auth/dtos/login.dto';
import { RefreshTokenDto } from '@modules/auth/dtos/refresh-token.dto';
import {
  VerifyEmailDto,
  ResendVerificationDto,
  ForgotPasswordDto,
  VerifyResetCodeDto,
  ResetPasswordDto,
} from '@modules/auth/dtos/verification.dto';
import {
  LoginResponseDto,
  RegisterResponseDto,
  TokensResponseDto,
  MessageResponseDto,
  AuthUserDto,
  RefreshTokenPayload,
  VerifyEmailResponseDto,
  VerifyResetCodeResponseDto,
} from '@modules/auth/dtos/auth-response.dto';
import { Public } from '@common/decorators/public.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user account
   */
  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register new user',
    description:
      'Create a new user account. A verification OTP will be sent to the provided email.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User registered successfully, verification email sent',
    type: RegisterResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email already exists',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error',
  })
  async register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.authService.register(dto);
  }

  /**
   * Login with email and password
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login user',
    description:
      'Authenticate with email and password. User must have verified email. Returns access and refresh tokens.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Account not verified or suspended',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<LoginResponseDto> {
    return this.authService.login(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: this.getClientIp(req),
    });
  }

  // ===========================================================================
  // Phase 2: Email Verification Endpoints
  // ===========================================================================

  /**
   * Verify email with OTP code
   */
  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email with OTP',
    description:
      'Verify email address using the 6-digit OTP sent to email. On success, returns tokens for auto-login.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Email verified successfully, user logged in',
    type: VerifyEmailResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired OTP code',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Too many failed attempts',
  })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() req: Request,
  ): Promise<VerifyEmailResponseDto> {
    return this.authService.verifyEmail(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: this.getClientIp(req),
    });
  }

  /**
   * Resend verification email
   */
  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend verification email',
    description:
      'Request a new verification OTP. Rate limited to prevent abuse (60s cooldown, 5/hour max).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Verification email sent (if account exists)',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded or cooldown period active',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Email already verified',
  })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<MessageResponseDto> {
    return this.authService.resendVerification(dto);
  }

  // ===========================================================================
  // Phase 2: Password Recovery Endpoints
  // ===========================================================================

  /**
   * Request password reset (forgot password)
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Request a password reset OTP. Always returns success to prevent email enumeration.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset email sent (if account exists)',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded',
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<MessageResponseDto> {
    return this.authService.forgotPassword(dto);
  }

  /**
   * Verify password reset code
   */
  @Public()
  @Post('verify-reset-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify password reset code',
    description:
      'Verify the 6-digit OTP for password reset. Use before resetting password to validate code.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reset code verified successfully',
    type: VerifyResetCodeResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired reset code',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Too many failed attempts',
  })
  async verifyResetCode(
    @Body() dto: VerifyResetCodeDto,
  ): Promise<VerifyResetCodeResponseDto> {
    return this.authService.verifyResetCode(dto);
  }

  /**
   * Reset password with OTP
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password',
    description:
      'Reset password using the 6-digit OTP. All active sessions will be terminated.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired reset code, or password validation failed',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Too many failed attempts',
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<MessageResponseDto> {
    return this.authService.resetPassword(dto);
  }

  // ===========================================================================
  // Token Management Endpoints
  // ===========================================================================

  /**
   * Refresh access token
   */
  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh tokens',
    description:
      'Get new access and refresh tokens. The used refresh token is revoked (rotation).',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tokens refreshed successfully',
    type: TokensResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired refresh token',
  })
  async refresh(@Req() req: Request): Promise<TokensResponseDto> {
    const payload = req.user as RefreshTokenPayload & { refreshToken: string };
    return this.authService.refreshTokens(payload, {
      userAgent: req.headers['user-agent'],
      ipAddress: this.getClientIp(req),
    });
  }

  /**
   * Logout - revoke current refresh token
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout',
    description: 'Revoke the refresh token to logout from current device.',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logged out successfully',
    type: MessageResponseDto,
  })
  async logout(@Body() dto: RefreshTokenDto): Promise<MessageResponseDto> {
    await this.authService.logout(dto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  /**
   * Logout from all devices
   */
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout from all devices',
    description: 'Revoke all refresh tokens to logout from all devices.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logged out from all devices',
    type: MessageResponseDto,
  })
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    const result = await this.authService.logoutAll(user.sub);
    return { message: `Logged out from ${result.revokedCount} device(s)` };
  }

  /**
   * Get current authenticated user
   */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user',
    description: 'Get the profile of the currently authenticated user.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profile',
    type: AuthUserDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<AuthUserDto> {
    return this.authService.getMe(user);
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Extract client IP from request
   */
  private getClientIp(req: Request): string | undefined {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded)) {
      return forwarded[0];
    }
    return req.ip;
  }
}
