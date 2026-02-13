import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Res,
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
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '@modules/auth/auth.service';
import { RegisterDto } from '@modules/auth/dtos/register.dto';
import { LoginDto } from '@modules/auth/dtos/login.dto';
import { RefreshTokenDto } from '@modules/auth/dtos/refresh-token.dto';
import {
  VerifyEmailDto,
  ResendVerificationDto,
  ForgotPasswordDto,
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
  @Throttle({
    short: { limit: 1, ttl: 2000 },
    medium: { limit: 3, ttl: 60000 },
  })
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
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded',
  })
  async register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.authService.register(dto);
  }

  /**
   * Login with email and password
   *
   * Sets refresh token as HttpOnly cookie for web clients.
   * Mobile/native clients should use the refresh token from the response body.
   */
  @Public()
  @Throttle({
    short: { limit: 1, ttl: 1000 },
    medium: { limit: 5, ttl: 60000 },
  })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login user',
    description:
      'Authenticate with email and password. User must have verified email. Returns access and refresh tokens. Web clients receive refresh token as HttpOnly cookie.',
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
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.login(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: this.getClientIp(req),
    });

    // Set tokens as HttpOnly cookies (web clients use these, mobile ignores them)
    this.authService.setRefreshTokenCookie(res, result.tokens.refreshToken);
    this.authService.setAccessTokenCookie(res, result.tokens.accessToken);

    return result;
  }

  // ===========================================================================
  // Phase 2: Email Verification Endpoints
  // ===========================================================================

  /**
   * Verify email with OTP code
   *
   * Sets refresh token as HttpOnly cookie for web clients (auto-login).
   */
  @Public()
  @Throttle({
    short: { limit: 1, ttl: 1000 },
    medium: { limit: 5, ttl: 60000 },
  })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email with OTP',
    description:
      'Verify email address using the 6-digit OTP sent to email. On success, returns tokens for auto-login. Web clients receive refresh token as HttpOnly cookie.',
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
    @Res({ passthrough: true }) res: Response,
  ): Promise<VerifyEmailResponseDto> {
    const result = await this.authService.verifyEmail(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: this.getClientIp(req),
    });

    // Set tokens as HttpOnly cookies (web clients use these, mobile ignores them)
    this.authService.setRefreshTokenCookie(res, result.tokens.refreshToken);
    this.authService.setAccessTokenCookie(res, result.tokens.accessToken);

    return result;
  }

  /**
   * Resend verification email
   */
  @Public()
  @Throttle({
    short: { limit: 1, ttl: 2000 },
    medium: { limit: 3, ttl: 60000 },
  })
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
  @Throttle({
    short: { limit: 1, ttl: 3000 },
    medium: { limit: 3, ttl: 300000 },
  })
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
   * Reset password with OTP
   */
  @Public()
  @Throttle({
    short: { limit: 1, ttl: 1000 },
    medium: { limit: 5, ttl: 60000 },
  })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password',
    description:
      'Reset password using the 6-digit OTP. The OTP is verified and consumed in a single step. All active sessions will be terminated.',
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
   *
   * Reads refresh token from HttpOnly cookie (web) or request body (mobile).
   * Sets new refresh token as HttpOnly cookie for web clients.
   */
  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh tokens',
    description:
      'Get new access and refresh tokens. The used refresh token is revoked (rotation). Web clients send refresh token via HttpOnly cookie; mobile clients send it in the request body.',
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
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokensResponseDto> {
    const payload = req.user as RefreshTokenPayload & { refreshToken: string };
    const tokens = await this.authService.refreshTokens(payload, {
      userAgent: req.headers['user-agent'],
      ipAddress: this.getClientIp(req),
    });

    // Set new tokens as HttpOnly cookies (web clients use these, mobile ignores them)
    this.authService.setRefreshTokenCookie(res, tokens.refreshToken);
    this.authService.setAccessTokenCookie(res, tokens.accessToken);

    return tokens;
  }

  /**
   * Logout - revoke current refresh token
   *
   * Clears refresh token cookie for web clients.
   * Mobile clients should send refresh token in body; web clients use the cookie.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout',
    description:
      'Revoke the refresh token to logout from current device. Web clients send refresh token via HttpOnly cookie; mobile clients send it in the request body.',
  })
  @ApiBody({ type: RefreshTokenDto, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logged out successfully',
    type: MessageResponseDto,
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: RefreshTokenDto,
  ): Promise<MessageResponseDto> {
    // Try cookie first (web clients), then body (mobile clients)
    const refreshToken =
      (req.cookies as Record<string, string | undefined>)?.refreshToken ??
      dto.refreshToken;

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    // Always clear cookies (no-op if not set)
    this.authService.clearRefreshTokenCookie(res);
    this.authService.clearAccessTokenCookie(res);

    return { message: 'Logged out successfully' };
  }

  /**
   * Logout from all devices
   *
   * Clears refresh token cookie for the current web session.
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
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponseDto> {
    const result = await this.authService.logoutAll(user.sub);

    // Clear cookies for the current browser session
    this.authService.clearRefreshTokenCookie(res);
    this.authService.clearAccessTokenCookie(res);

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
