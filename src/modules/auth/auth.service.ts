import {
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { CookieOptions, Response } from 'express';
import { ERROR_CODES } from '@common/constants/app.constants';
import { BusinessException } from '@common/exceptions/business.exception';
import { RefreshTokensRepository } from '@modules/auth/refresh-tokens.repository';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import {
  AuthUserDto,
  JwtPayload,
  LoginResponseDto,
  MessageResponseDto,
  RefreshTokenPayload,
  RegisterResponseDto,
  TokensResponseDto,
  VerifyEmailResponseDto,
} from '@modules/auth/dtos/auth-response.dto';
import { LoginDto } from '@modules/auth/dtos/login.dto';
import { RegisterDto } from '@modules/auth/dtos/register.dto';
import {
  ForgotPasswordDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from '@modules/auth/dtos/verification.dto';
import { ACCESS_TOKEN_COOKIE_NAME } from '@modules/auth/strategies/jwt.strategy';
import { REFRESH_TOKEN_COOKIE_NAME } from '@modules/auth/strategies/jwt-refresh.strategy';
import { UsersService } from '@modules/users/users.service';
import { OtpService } from '@modules/otp/otp.service';
import { ConfigService } from '@config/config.service';
import { PrismaService } from '@database/prisma.service';
import { MailService } from '@mail/mail.service';
import { FileService } from '@storage/services/file.service';
import {
  OtpType,
  PlatformRole,
  Prisma,
  User,
  UserStatus,
  Workspace,
  WorkspaceMembership,
  WorkspaceMembershipStatus,
  WorkspaceRole,
  WorkspaceStatus,
  WorkspaceType,
} from '../../generated/prisma/client';

interface RequestMetadata {
  userAgent?: string;
  ipAddress?: string;
}

interface WorkspaceSessionContext {
  workspace: Workspace;
  membership: WorkspaceMembership;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTokenExpiry: number;
  private readonly refreshTokenExpirySeconds: number;

  constructor(
    private readonly fileService: FileService,
    private readonly usersService: UsersService,
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
  ) {
    this.accessTokenExpiry = this.parseExpiryToSeconds(
      this.configService.jwt.accessExpires || '1h',
    );
    this.refreshTokenExpirySeconds = this.parseExpiryToSeconds(
      this.configService.jwt.refreshExpires || '7d',
    );
  }

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const emailExists = await this.usersService.emailExists(dto.email);
    if (emailExists) {
      throw new ConflictException({
        code: ERROR_CODES.EMAIL_ALREADY_EXISTS,
        message: 'An account with this email already exists',
      });
    }

    const hashedPassword = await argon2.hash(dto.password);

    const { user, context } = await this.prisma.$transaction(
      async (tx) => {
        const workspaceName = this.buildDefaultWorkspaceName(dto);

        const workspace = await tx.workspace.create({
          data: {
            name: workspaceName,
            type: WorkspaceType.PERSONAL,
            status: WorkspaceStatus.ACTIVE,
          },
        });

        const user = await tx.user.create({
          data: {
            email: dto.email.toLowerCase(),
            password: hashedPassword,
            firstName: dto.firstName,
            lastName: dto.lastName,
            status: UserStatus.PENDING_VERIFICATION,
            emailVerified: false,
            platformRole: PlatformRole.USER,
          },
        });

        const membership = await tx.workspaceMembership.create({
          data: {
            workspaceId: workspace.id,
            userId: user.id,
            role: WorkspaceRole.ADMIN,
            status: WorkspaceMembershipStatus.ACTIVE,
          },
        });

        await tx.workspaceSettings.create({
          data: {
            workspaceId: workspace.id,
          },
        });

        return {
          user,
          context: {
            workspace,
            membership,
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    this.sendVerificationEmail(user).catch((error) => {
      this.logger.error(
        `Failed to send verification email to ${user.email}`,
        error.stack,
      );
    });

    const principal = this.buildAuthenticatedPrincipal(user, context);

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
      user: await this.toAuthUserDto(principal),
    };
  }

  async login(
    dto: LoginDto,
    metadata?: RequestMetadata,
  ): Promise<LoginResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }

    const isPasswordValid = await argon2.verify(user.password, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }

    const loginStatus = this.usersService.canLogin(user);
    if (!loginStatus.allowed) {
      this.throwStatusError(loginStatus.reason!);
    }

    const context = await this.resolveLoginWorkspaceContext(user.id);
    const principal = this.buildAuthenticatedPrincipal(user, context);
    const tokens = await this.generateTokens(principal, metadata);

    return {
      tokens,
      user: await this.toAuthUserDto(principal),
    };
  }

  async verifyEmail(
    dto: VerifyEmailDto,
    metadata?: RequestMetadata,
  ): Promise<VerifyEmailResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new BusinessException(
        ERROR_CODES.USER_NOT_FOUND,
        'No account found with this email address',
        HttpStatus.NOT_FOUND,
      );
    }

    if (user.emailVerified) {
      throw new BusinessException(
        ERROR_CODES.EMAIL_ALREADY_VERIFIED,
        'Email is already verified. Please login.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.otpService.verify(dto.code, user.id, OtpType.EMAIL_VERIFICATION);

    const updatedUser = await this.usersService.verifyEmail(user.id);

    this.sendWelcomeEmail(updatedUser).catch((error) => {
      this.logger.error(
        `Failed to send welcome email to ${updatedUser.email}`,
        error.stack,
      );
    });

    const context = await this.resolveLoginWorkspaceContext(updatedUser.id);
    const principal = this.buildAuthenticatedPrincipal(updatedUser, context);
    const tokens = await this.generateTokens(principal, metadata);

    return {
      message: 'Email verified successfully. You are now logged in.',
      tokens,
      user: await this.toAuthUserDto(principal),
    };
  }

  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<MessageResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      return {
        message:
          'If an account exists with this email, a verification code has been sent.',
      };
    }

    if (user.emailVerified) {
      throw new BusinessException(
        ERROR_CODES.EMAIL_ALREADY_VERIFIED,
        'Email is already verified. Please login.',
        HttpStatus.BAD_REQUEST,
      );
    }

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

  async forgotPassword(dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);

    const successMessage = {
      message:
        'If an account exists with this email, a password reset code has been sent.',
    };

    if (!user || user.status === UserStatus.DELETED) {
      return successMessage;
    }

    this.sendPasswordResetEmail(user).catch((error) => {
      this.logger.error(
        `Failed to send password reset email to ${user.email}`,
        error.stack,
      );
    });

    return successMessage;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<MessageResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new BusinessException(
        ERROR_CODES.INVALID_OTP,
        'Invalid or expired reset code',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.otpService.verify(dto.code, user.id, OtpType.PASSWORD_RESET);

    const hashedPassword = await argon2.hash(dto.newPassword);

    await Promise.all([
      this.usersService.updatePassword(user.id, hashedPassword),
      this.refreshTokensRepository.revokeAllForUser(user.id),
    ]);

    return {
      message:
        'Password has been reset successfully. Please login with your new password.',
    };
  }

  async refreshTokens(
    payload: RefreshTokenPayload & { refreshToken: string },
    metadata?: RequestMetadata,
  ): Promise<TokensResponseDto> {
    const storedToken = await this.refreshTokensRepository.findById(
      payload.tokenId,
    );

    if (!storedToken) {
      throw new UnauthorizedException({
        code: ERROR_CODES.REFRESH_TOKEN_INVALID,
        message: 'Invalid refresh token',
      });
    }

    if (!this.refreshTokensRepository.isTokenValid(storedToken)) {
      throw new UnauthorizedException({
        code: ERROR_CODES.REFRESH_TOKEN_REVOKED,
        message: 'Refresh token has been revoked or expired',
      });
    }

    const tokenHash = this.hashToken(payload.refreshToken);
    if (storedToken.token !== tokenHash || storedToken.userId !== payload.sub) {
      await this.refreshTokensRepository.revokeAllForUser(storedToken.userId);
      throw new UnauthorizedException({
        code: ERROR_CODES.REFRESH_TOKEN_INVALID,
        message: 'Invalid refresh token',
      });
    }

    const [, user, context] = await Promise.all([
      this.refreshTokensRepository.revoke(storedToken.id),
      this.usersService.findById(storedToken.userId),
      this.resolveRefreshWorkspaceContext(
        storedToken.userId,
        payload.membershipId,
        payload.workspaceId,
      ),
    ]);

    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'User not found',
      });
    }

    const loginStatus = this.usersService.canLogin(user);
    if (!loginStatus.allowed) {
      this.throwStatusError(loginStatus.reason!);
    }

    const principal = this.buildAuthenticatedPrincipal(user, context);

    return this.generateTokens(principal, metadata);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.refreshTokensRepository.revokeByToken(tokenHash);
  }

  async logoutAll(userId: string): Promise<{ revokedCount: number }> {
    const result = await this.refreshTokensRepository.revokeAllForUser(userId);
    return { revokedCount: result.count };
  }

  async getMe(principal: AuthenticatedPrincipal): Promise<AuthUserDto> {
    const avatar = await this.usersService.findAvatarByUserId(principal.sub);

    return this.toAuthUserDto(principal, avatar);
  }

  async uploadAvatar(
    principal: AuthenticatedPrincipal,
    file: Express.Multer.File,
  ): Promise<AuthUserDto> {
    const user = await this.usersService.findById(principal.sub);

    if (!user) {
      throw new BusinessException(
        ERROR_CODES.USER_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const uploadedAvatar = await this.fileService.uploadPublicObject(
      file,
      'avatars',
    );

    try {
      const { avatar, previousAvatarStorageKey } =
        await this.usersService.replaceAvatar(principal.sub, {
          avatarUrl: uploadedAvatar.publicUrl,
          avatarStorageKey: uploadedAvatar.key,
        });

      if (
        previousAvatarStorageKey &&
        previousAvatarStorageKey !== avatar.avatarStorageKey
      ) {
        await this.safeDeleteStorageObject(previousAvatarStorageKey);
      }

      return this.toAuthUserDto({ ...principal, user }, avatar.avatarUrl);
    } catch (error) {
      await this.safeDeleteStorageObject(uploadedAvatar.key);
      throw error;
    }
  }

  async removeAvatar(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new BusinessException(
        ERROR_CODES.USER_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const { previousAvatarStorageKey } =
      await this.usersService.removeAvatar(userId);

    if (previousAvatarStorageKey) {
      await this.safeDeleteStorageObject(previousAvatarStorageKey);
    }
  }

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

  private async sendWelcomeEmail(user: User): Promise<void> {
    const loginUrl = 'https://app.facets.com/login';

    await this.mailService.sendTemplate('welcome', user.email, {
      userName: user.firstName,
      appName: 'Facets',
      loginUrl,
    });
  }

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

  private async generateTokens(
    principal: AuthenticatedPrincipal,
    metadata?: RequestMetadata,
  ): Promise<TokensResponseDto> {
    const tokenId = crypto.randomUUID();

    const accessPayload: JwtPayload = {
      sub: principal.sub,
      email: principal.email,
      workspaceId: principal.workspaceId,
      membershipId: principal.membershipId,
      workspaceRole: principal.workspaceRole,
      platformRole: principal.platformRole,
    };

    const refreshPayload: RefreshTokenPayload = {
      ...accessPayload,
      tokenId,
    };

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
      id: tokenId,
      token: this.hashToken(refreshToken),
      userId: principal.sub,
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

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async toAuthUserDto(
    principal: AuthenticatedPrincipal,
    avatarUrl?: string | null,
  ): Promise<AuthUserDto> {
    const { user, workspace, membership } = principal;

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified,
      status: user.status,
      createdAt: user.createdAt,
      avatarUrl: avatarUrl ?? undefined,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
        status: workspace.status,
      },
      membership: {
        id: membership.id,
        role: membership.role,
        status: membership.status,
      },
      platformRole: user.platformRole,
    };
  }

  private async safeDeleteStorageObject(key: string): Promise<void> {
    try {
      await this.fileService.deleteObject(this.getPublicBucketOrThrow(), key);
    } catch (cleanupError) {
      this.logger.error(
        `Failed to cleanup avatar object ${key}`,
        cleanupError instanceof Error
          ? cleanupError.stack
          : String(cleanupError),
      );
    }
  }

  private getPublicBucketOrThrow(): string {
    const publicBucket = this.configService.storage.publicBucket;

    if (!publicBucket) {
      throw new Error(
        'Missing required storage configuration: R2_PUBLIC_BUCKET',
      );
    }

    return publicBucket;
  }

  private buildAuthenticatedPrincipal(
    user: User,
    context: WorkspaceSessionContext,
  ): AuthenticatedPrincipal {
    return {
      sub: user.id,
      email: user.email,
      workspaceId: context.workspace.id,
      actorUserId: user.id,
      membershipId: context.membership.id,
      workspaceRole: context.membership.role,
      platformRole: user.platformRole,
      user,
      workspace: context.workspace,
      membership: context.membership,
    };
  }

  private async resolveLoginWorkspaceContext(
    userId: string,
  ): Promise<WorkspaceSessionContext> {
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        status: WorkspaceMembershipStatus.ACTIVE,
        workspace: {
          status: WorkspaceStatus.ACTIVE,
        },
      },
      include: {
        workspace: true,
      },
      orderBy: [{ joinedAt: 'asc' }, { createdAt: 'asc' }],
    });

    if (!membership) {
      throw new BusinessException(
        ERROR_CODES.UNAUTHORIZED,
        'Account access is not valid for workspace context resolution',
        HttpStatus.FORBIDDEN,
      );
    }

    return {
      workspace: membership.workspace,
      membership,
    };
  }

  private async resolveRefreshWorkspaceContext(
    userId: string,
    membershipId: string,
    workspaceId: string,
  ): Promise<WorkspaceSessionContext> {
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        id: membershipId,
        userId,
        workspaceId,
        status: WorkspaceMembershipStatus.ACTIVE,
        workspace: {
          status: WorkspaceStatus.ACTIVE,
        },
      },
      include: {
        workspace: true,
      },
    });

    if (!membership) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Workspace membership is no longer active',
      });
    }

    return {
      workspace: membership.workspace,
      membership,
    };
  }

  private buildDefaultWorkspaceName(dto: RegisterDto): string {
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const fullName = `${firstName} ${lastName}`.trim();

    if (fullName.length > 0) {
      return `${fullName} Workspace`;
    }

    if (firstName.length > 0) {
      return `${firstName} Workspace`;
    }

    const emailLocalPart = dto.email.split('@')[0]?.trim() || 'Personal';
    return `${emailLocalPart} Workspace`;
  }

  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)(s|m|h|d)$/);
    if (!match) {
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

  private getRefreshTokenCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.configService.isProduction,
      sameSite: 'strict',
      path: this.configService.cookie.refreshTokenPath,
      maxAge: this.refreshTokenExpirySeconds * 1000,
    };
  }

  setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      refreshToken,
      this.getRefreshTokenCookieOptions(),
    );
  }

  clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
      httpOnly: true,
      secure: this.configService.isProduction,
      sameSite: 'strict',
      path: this.configService.cookie.refreshTokenPath,
    });
  }

  private getAccessTokenCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.configService.isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: this.accessTokenExpiry * 1000,
    };
  }

  setAccessTokenCookie(res: Response, accessToken: string): void {
    res.cookie(
      ACCESS_TOKEN_COOKIE_NAME,
      accessToken,
      this.getAccessTokenCookieOptions(),
    );
  }

  clearAccessTokenCookie(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, {
      httpOnly: true,
      secure: this.configService.isProduction,
      sameSite: 'strict',
      path: '/',
    });
  }
}
