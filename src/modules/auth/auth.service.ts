import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { Response, CookieOptions } from 'express';
import { ConfigService } from '@config/config.service';
import { PrismaService } from '@database/prisma.service';
import { UsersService } from '@modules/users/users.service';
import { RefreshTokensRepository } from '@modules/auth/refresh-tokens.repository';
import { OtpService } from '@modules/otp/otp.service';
import { MailService } from '@mail/mail.service';
import { SubscriptionsService } from '@modules/subscriptions/subscriptions.service';
import { REFRESH_TOKEN_COOKIE_NAME } from '@modules/auth/strategies/jwt-refresh.strategy';
import { RegisterDto } from '@modules/auth/dtos/register.dto';
import { LoginDto } from '@modules/auth/dtos/login.dto';
import {
  VerifyEmailDto,
  ResendVerificationDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '@modules/auth/dtos/verification.dto';
import {
  JwtPayload,
  RefreshTokenPayload,
  TokensResponseDto,
  AuthUserDto,
  LoginResponseDto,
  RegisterResponseDto,
  MessageResponseDto,
  VerifyEmailResponseDto,
} from '@modules/auth/dtos/auth-response.dto';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_CODES } from '@common/constants/app.constants';
import {
  User,
  OtpType,
  UserStatus,
  SubscriptionStatus,
} from '../../generated/prisma/client';

interface RequestMetadata {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTokenExpiry: number; // in seconds
  private readonly refreshTokenExpirySeconds: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {
    // Parse access token expiry to seconds (e.g., '1h' -> 3600)
    this.accessTokenExpiry = this.parseExpiryToSeconds(
      this.configService.jwt.accessExpires || '1h',
    );
    // Parse refresh token expiry to seconds (e.g., '7d' -> 604800)
    this.refreshTokenExpirySeconds = this.parseExpiryToSeconds(
      this.configService.jwt.refreshExpires || '7d',
    );
  }

  /**
   * Register a new user
   *
   * Creates user with PENDING_VERIFICATION status and sends verification OTP email.
   */
  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    // Check if email already exists
    const emailExists = await this.usersService.emailExists(dto.email);
    if (emailExists) {
      throw new ConflictException({
        code: ERROR_CODES.EMAIL_ALREADY_EXISTS,
        message: 'An account with this email already exists',
      });
    }

    // Hash password with Argon2id (more secure, faster than bcrypt)
    const hashedPassword = await argon2.hash(dto.password);

    // Create user + subscription atomically in a single transaction
    const { user, subscription } = await this.prisma.$transaction(
      async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: dto.email.toLowerCase(),
            password: hashedPassword,
            firstName: dto.firstName,
            lastName: dto.lastName,
            status: UserStatus.PENDING_VERIFICATION,
            emailVerified: false,
          },
        });

        const defaultPlan = await tx.plan.findFirst({
          where: { isDefault: true, isActive: true },
          include: { planFeatures: true },
        });

        if (!defaultPlan) {
          throw new BusinessException(
            ERROR_CODES.INTERNAL_ERROR,
            'Default plan not configured',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        const newSubscription = await tx.subscription.create({
          data: {
            userId: newUser.id,
            planId: defaultPlan.id,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: new Date(),
            currentPeriodEnd: null, // Free plan has no end date
          },
          include: {
            plan: { include: { planFeatures: true } },
          },
        });

        return { user: newUser, subscription: newSubscription };
      },
    );

    // Generate OTP and send verification email (fire-and-forget, don't block response)
    this.sendVerificationEmail(user).catch((error) => {
      this.logger.error(
        `Failed to send verification email to ${user.email}`,
        error.stack,
      );
    });

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
      user: this.toAuthUserDto(user, {
        code: subscription.plan.code,
        name: subscription.plan.name,
      }),
    };
  }

  /**
   * Login a user with email and password
   *
   * Validates credentials and user status, then generates tokens.
   */
  async login(
    dto: LoginDto,
    metadata?: RequestMetadata,
  ): Promise<LoginResponseDto> {
    // Find user by email
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }

    // Verify password
    const isPasswordValid = await argon2.verify(user.password, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }

    // Check if user can login (status check)
    const loginStatus = this.usersService.canLogin(user);
    if (!loginStatus.allowed) {
      this.throwStatusError(loginStatus.reason!);
    }

    // Generate tokens and get plan in parallel (independent operations)
    const [tokens, plan] = await Promise.all([
      this.generateTokens(user, metadata),
      this.getUserPlan(user.id),
    ]);

    return {
      tokens,
      user: this.toAuthUserDto(user, plan),
    };
  }

  /**
   * Verify email with OTP code
   *
   * Validates the OTP, marks user as verified, sends welcome email, and returns tokens for auto-login.
   */
  async verifyEmail(
    dto: VerifyEmailDto,
    metadata?: RequestMetadata,
  ): Promise<VerifyEmailResponseDto> {
    // Find user by email
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new BusinessException(
        ERROR_CODES.USER_NOT_FOUND,
        'No account found with this email address',
        HttpStatus.NOT_FOUND,
      );
    }

    // Check if already verified
    if (user.emailVerified) {
      throw new BusinessException(
        ERROR_CODES.EMAIL_ALREADY_VERIFIED,
        'Email is already verified. Please login.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Verify OTP
    await this.otpService.verify(dto.code, user.id, OtpType.EMAIL_VERIFICATION);

    // Mark user as verified
    const updatedUser = await this.usersService.verifyEmail(user.id);

    // Send welcome email (fire-and-forget, don't block the response)
    this.sendWelcomeEmail(updatedUser).catch((error) => {
      this.logger.error(
        `Failed to send welcome email to ${updatedUser.email}`,
        error.stack,
      );
    });

    // Generate tokens and get plan in parallel (independent operations)
    const [tokens, plan] = await Promise.all([
      this.generateTokens(updatedUser, metadata),
      this.getUserPlan(updatedUser.id),
    ]);

    return {
      message: 'Email verified successfully. You are now logged in.',
      tokens,
      user: this.toAuthUserDto(updatedUser, plan),
    };
  }

  /**
   * Resend verification email
   *
   * Generates a new OTP and sends verification email.
   */
  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<MessageResponseDto> {
    // Find user by email
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      // Return success message even if user not found (avoid email enumeration)
      return {
        message:
          'If an account exists with this email, a verification code has been sent.',
      };
    }

    // Check if already verified
    if (user.emailVerified) {
      throw new BusinessException(
        ERROR_CODES.EMAIL_ALREADY_VERIFIED,
        'Email is already verified. Please login.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Generate new OTP and send email (fire-and-forget, don't block response)
    this.sendVerificationEmail(user).catch((error) => {
      this.logger.error(
        `Failed to send verification email to ${user.email}`,
        error.stack,
      );
    });

    return {
      message:
        'If an account exists with this email, a verification code has been sent.',
    };
  }

  /**
   * Initiate password reset (forgot password)
   *
   * Generates OTP and sends password reset email.
   * Always returns success to prevent email enumeration.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    // Find user by email
    const user = await this.usersService.findByEmail(dto.email);

    // Always return success to prevent email enumeration
    const successMessage = {
      message:
        'If an account exists with this email, a password reset code has been sent.',
    };

    if (!user) {
      return successMessage;
    }

    // Don't send reset email for deleted accounts
    if (user.status === UserStatus.DELETED) {
      return successMessage;
    }

    // Generate OTP and send password reset email (fire-and-forget, don't block response)
    this.sendPasswordResetEmail(user).catch((error) => {
      this.logger.error(
        `Failed to send password reset email to ${user.email}`,
        error.stack,
      );
    });

    return successMessage;
  }

  /**
   * Reset password with verified OTP
   *
   * Verifies the OTP, consumes it, updates the password, and revokes all sessions.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<MessageResponseDto> {
    // Find user by email
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new BusinessException(
        ERROR_CODES.INVALID_OTP,
        'Invalid or expired reset code',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Verify OTP
    await this.otpService.verify(dto.code, user.id, OtpType.PASSWORD_RESET);

    // Hash new password
    const hashedPassword = await argon2.hash(dto.newPassword);

    // Update password and revoke all tokens in parallel (independent operations)
    await Promise.all([
      this.usersService.updatePassword(user.id, hashedPassword),
      this.refreshTokensRepository.revokeAllForUser(user.id),
    ]);

    return {
      message:
        'Password has been reset successfully. Please login with your new password.',
    };
  }

  /**
   * Refresh access token using a valid refresh token
   *
   * Implements token rotation: the used refresh token is revoked
   * and a new one is issued.
   */
  async refreshTokens(
    payload: RefreshTokenPayload & { refreshToken: string },
    metadata?: RequestMetadata,
  ): Promise<TokensResponseDto> {
    // Find the refresh token in database
    const storedToken = await this.refreshTokensRepository.findById(
      payload.tokenId,
    );

    if (!storedToken) {
      throw new UnauthorizedException({
        code: ERROR_CODES.REFRESH_TOKEN_INVALID,
        message: 'Invalid refresh token',
      });
    }

    // Check if token is still valid (not revoked, not expired)
    if (!this.refreshTokensRepository.isTokenValid(storedToken)) {
      throw new UnauthorizedException({
        code: ERROR_CODES.REFRESH_TOKEN_REVOKED,
        message: 'Refresh token has been revoked or expired',
      });
    }

    // Verify token hash matches (extra security)
    const tokenHash = this.hashToken(payload.refreshToken);
    if (storedToken.token !== tokenHash) {
      // Token mismatch - possible token theft, revoke all user tokens
      await this.refreshTokensRepository.revokeAllForUser(storedToken.userId);
      throw new UnauthorizedException({
        code: ERROR_CODES.REFRESH_TOKEN_INVALID,
        message: 'Invalid refresh token',
      });
    }

    // Revoke current token and fetch user in parallel (independent operations)
    const [, user] = await Promise.all([
      this.refreshTokensRepository.revoke(storedToken.id),
      this.usersService.findById(storedToken.userId),
    ]);

    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'User not found',
      });
    }

    // Check user status
    const loginStatus = this.usersService.canLogin(user);
    if (!loginStatus.allowed) {
      this.throwStatusError(loginStatus.reason!);
    }

    // Generate new tokens
    return this.generateTokens(user, metadata);
  }

  /**
   * Logout - revoke the specific refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.refreshTokensRepository.revokeByToken(tokenHash);
  }

  /**
   * Logout from all devices - revoke all refresh tokens for user
   */
  async logoutAll(userId: string): Promise<{ revokedCount: number }> {
    const result = await this.refreshTokensRepository.revokeAllForUser(userId);
    return { revokedCount: result.count };
  }

  /**
   * Get current user (for /auth/me endpoint)
   *
   * Uses the user already loaded by JwtStrategy to avoid a redundant DB query.
   */
  async getMe(authenticatedUser: {
    sub: string;
    user: User;
  }): Promise<AuthUserDto> {
    const plan = await this.getUserPlan(authenticatedUser.sub);
    return this.toAuthUserDto(authenticatedUser.user, plan);
  }

  // ==========================================================================
  // Private helper methods
  // ==========================================================================

  /**
   * Get user's current plan info (for including in auth responses)
   */
  private async getUserPlan(
    userId: string,
  ): Promise<{ code: string; name: string } | undefined> {
    try {
      const subscription =
        await this.subscriptionsService.getUserSubscription(userId);
      return {
        code: subscription.plan.code,
        name: subscription.plan.name,
      };
    } catch {
      // User may not have a subscription yet (shouldn't happen, but be safe)
      return undefined;
    }
  }

  /**
   * Send verification email with OTP
   */
  private async sendVerificationEmail(user: User): Promise<void> {
    const otpResult = await this.otpService.generate(
      user.id,
      OtpType.EMAIL_VERIFICATION,
    );

    await this.mailService.sendTemplate('email-verification', user.email, {
      userName: user.firstName,
      otpCode: otpResult.code,
      expiresInMinutes: this.otpService.getExpiryMinutes(),
    });
  }

  /**
   * Send welcome email after successful email verification
   */
  private async sendWelcomeEmail(user: User): Promise<void> {
    // TODO: Move this URL to configuration when frontend is ready
    const loginUrl = 'https://app.facets.com/login';

    await this.mailService.sendTemplate('welcome', user.email, {
      userName: user.firstName,
      appName: 'Facets',
      loginUrl,
    });
  }

  /**
   * Send password reset email with OTP
   */
  private async sendPasswordResetEmail(user: User): Promise<void> {
    const otpResult = await this.otpService.generate(
      user.id,
      OtpType.PASSWORD_RESET,
    );

    await this.mailService.sendTemplate('password-reset', user.email, {
      userName: user.firstName,
      otpCode: otpResult.code,
      expiresInMinutes: this.otpService.getExpiryMinutes(),
    });
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(
    user: User,
    metadata?: RequestMetadata,
  ): Promise<TokensResponseDto> {
    // Generate a unique token ID for the refresh token
    const tokenId = crypto.randomUUID();

    // Create JWT payloads
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      email: user.email,
      tokenId,
    };

    // Generate tokens
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.configService.jwt.accessSecret,
        expiresIn: this.accessTokenExpiry,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.jwt.refreshSecret,
        expiresIn: this.refreshTokenExpirySeconds,
      }),
    ]);

    const expiresAt = new Date(
      Date.now() + this.refreshTokenExpirySeconds * 1000,
    );

    await this.refreshTokensRepository.create({
      token: this.hashToken(refreshToken),
      userId: user.id,
      expiresAt,
      userAgent: metadata?.userAgent,
      ipAddress: metadata?.ipAddress,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpiry,
    };
  }

  /**
   * Hash a token for storage (using SHA-256)
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Convert User entity to AuthUserDto (excludes sensitive fields)
   */
  private toAuthUserDto(
    user: User,
    plan?: { code: string; name: string },
  ): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified,
      status: user.status,
      createdAt: user.createdAt,
      plan,
    };
  }

  /**
   * Parse expiry string to seconds (e.g., '1h' -> 3600, '7d' -> 604800)
   */
  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)(s|m|h|d)$/);
    if (!match) {
      // Default to 1 hour if invalid format
      return 3600;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 3600;
    }
  }

  /**
   * Throw appropriate error based on user status
   */
  private throwStatusError(reason: string): never {
    switch (reason) {
      case 'EMAIL_NOT_VERIFIED':
        throw new BusinessException(
          ERROR_CODES.EMAIL_NOT_VERIFIED,
          'Please verify your email before logging in',
          HttpStatus.FORBIDDEN,
        );
      case 'ACCOUNT_SUSPENDED':
        throw new BusinessException(
          ERROR_CODES.ACCOUNT_SUSPENDED,
          'Your account has been suspended',
          HttpStatus.FORBIDDEN,
        );
      case 'ACCOUNT_DELETED':
        throw new BusinessException(
          ERROR_CODES.ACCOUNT_DELETED,
          'This account has been deleted',
          HttpStatus.FORBIDDEN,
        );
      default:
        throw new UnauthorizedException({
          code: ERROR_CODES.UNAUTHORIZED,
          message: 'Account access denied',
        });
    }
  }

  // ==========================================================================
  // Cookie management (for web clients)
  // ==========================================================================

  /**
   * Get the cookie options for the refresh token
   *
   * - httpOnly: Not accessible from JavaScript (prevents XSS token theft)
   * - secure: Only sent over HTTPS (except in development)
   * - sameSite: 'strict' for CSRF protection
   * - path: Restricted to the refresh endpoint only
   * - maxAge: Matches the refresh token expiry
   */
  private getRefreshTokenCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.configService.isProduction,
      sameSite: 'strict',
      path: this.configService.cookie.refreshTokenPath,
      maxAge: this.refreshTokenExpirySeconds * 1000, // Convert to milliseconds
    };
  }

  /**
   * Set the refresh token as an HttpOnly cookie on the response
   *
   * This is for web clients only. Mobile/native clients should use
   * the refresh token from the response body and store it in Secure Storage.
   */
  setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      refreshToken,
      this.getRefreshTokenCookieOptions(),
    );
  }

  /**
   * Clear the refresh token cookie from the response
   *
   * Used during logout to ensure the cookie is removed from the browser.
   */
  clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
      httpOnly: true,
      secure: this.configService.isProduction,
      sameSite: 'strict',
      path: this.configService.cookie.refreshTokenPath,
    });
  }
}
