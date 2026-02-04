/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from '@modules/auth/auth.service';
import { UsersService } from '@modules/users/users.service';
import { RefreshTokensRepository } from '@modules/auth/refresh-tokens.repository';
import { OtpService } from '@modules/otp/otp.service';
import { MailService } from '@mail/mail.service';
import { ConfigService } from '@config/config.service';
import { SubscriptionsService } from '@modules/subscriptions/subscriptions.service';
import { UserStatus, OtpType } from '../../generated/prisma/client';

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let refreshTokensRepository: jest.Mocked<RefreshTokensRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let otpService: jest.Mocked<OtpService>;
  let mailService: jest.Mocked<MailService>;
  let subscriptionsService: jest.Mocked<SubscriptionsService>;

  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    password: 'hashed-password',
    firstName: 'Test',
    lastName: 'User',
    emailVerified: true,
    emailVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockRefreshToken = {
    id: 'token-id',
    token: 'hashed-token',
    userId: mockUser.id,
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    revokedAt: null,
  };

  const mockOtpResult = {
    code: '123456',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    otpId: 'otp-123',
  };

  beforeEach(async () => {
    const mockUsersService = {
      create: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      emailExists: jest.fn(),
      verifyEmail: jest.fn(),
      updatePassword: jest.fn(),
      excludePassword: jest.fn(),
      canLogin: jest.fn(),
    };

    const mockRefreshTokensRepository = {
      create: jest.fn(),
      findByToken: jest.fn(),
      findById: jest.fn(),
      findActiveByUserId: jest.fn(),
      revoke: jest.fn(),
      revokeByToken: jest.fn(),
      revokeAllForUser: jest.fn(),
      deleteExpired: jest.fn(),
      isTokenValid: jest.fn(),
    };

    const mockJwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    const mockConfigService = {
      jwt: {
        accessSecret: 'test-access-secret',
        refreshSecret: 'test-refresh-secret',
        accessExpires: '1h',
        refreshExpires: '7d',
      },
    };

    const mockOtpService = {
      generate: jest.fn(),
      verify: jest.fn(),
      getExpiryMinutes: jest.fn().mockReturnValue(10),
    };

    const mockMailService = {
      sendTemplate: jest.fn(),
      send: jest.fn(),
    };

    const mockSubscriptionsService = {
      createSubscriptionForNewUser: jest.fn(),
      getUserSubscription: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        {
          provide: RefreshTokensRepository,
          useValue: mockRefreshTokensRepository,
        },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: OtpService, useValue: mockOtpService },
        { provide: MailService, useValue: mockMailService },
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    refreshTokensRepository = module.get(RefreshTokensRepository);
    jwtService = module.get(JwtService);
    otpService = module.get(OtpService);
    mailService = module.get(MailService);
    subscriptionsService = module.get(SubscriptionsService);
  });

  describe('register', () => {
    const registerDto = {
      email: 'new@example.com',
      password: 'SecurePass123',
      firstName: 'New',
      lastName: 'User',
    };

    it('should register a new user successfully', async () => {
      usersService.emailExists.mockResolvedValue(false);
      usersService.create.mockResolvedValue({
        ...mockUser,
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        status: UserStatus.PENDING_VERIFICATION,
        emailVerified: false,
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      otpService.generate.mockResolvedValue(mockOtpResult);
      mailService.sendTemplate.mockResolvedValue(undefined);
      subscriptionsService.createSubscriptionForNewUser.mockResolvedValue({
        id: 'subscription-id',
        plan: { code: 'FREE', name: 'Free' },
      } as never);

      const result = await authService.register(registerDto);

      expect(result.message).toContain('Registration successful');
      expect(result.user.email).toBe(registerDto.email);
      expect(usersService.emailExists).toHaveBeenCalledWith(registerDto.email);
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(otpService.generate).toHaveBeenCalledWith(
        expect.any(String),
        OtpType.EMAIL_VERIFICATION,
      );
      expect(mailService.sendTemplate).toHaveBeenCalledWith(
        'email-verification',
        registerDto.email,
        expect.objectContaining({
          otpCode: mockOtpResult.code,
        }),
      );
    });

    it('should throw ConflictException when email already exists', async () => {
      usersService.emailExists.mockResolvedValue(true);

      await expect(authService.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'SecurePass123',
    };

    it('should login successfully with valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      usersService.canLogin.mockReturnValue({ allowed: true });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('mock-token');
      refreshTokensRepository.create.mockResolvedValue(mockRefreshToken);
      subscriptionsService.getUserSubscription.mockResolvedValue({
        plan: { code: 'FREE', name: 'Free' },
      } as never);

      const result = await authService.login(loginDto);

      expect(result.tokens.accessToken).toBe('mock-token');
      expect(result.tokens.refreshToken).toBe('mock-token');
      expect(result.user.email).toBe(mockUser.email);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw when user is pending verification', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        status: UserStatus.PENDING_VERIFICATION,
      });
      usersService.canLogin.mockReturnValue({
        allowed: false,
        reason: 'EMAIL_NOT_VERIFIED',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(authService.login(loginDto)).rejects.toThrow();
    });

    it('should throw when user is suspended', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        status: UserStatus.SUSPENDED,
      });
      usersService.canLogin.mockReturnValue({
        allowed: false,
        reason: 'ACCOUNT_SUSPENDED',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(authService.login(loginDto)).rejects.toThrow();
    });
  });

  describe('refreshTokens', () => {
    const payload = {
      sub: mockUser.id,
      email: mockUser.email,
      tokenId: mockRefreshToken.id,
      refreshToken: 'original-token',
    };

    it('should refresh tokens successfully', async () => {
      refreshTokensRepository.findById.mockResolvedValue(mockRefreshToken);
      refreshTokensRepository.isTokenValid.mockReturnValue(true);
      refreshTokensRepository.revoke.mockResolvedValue(mockRefreshToken);
      refreshTokensRepository.create.mockResolvedValue(mockRefreshToken);
      usersService.findById.mockResolvedValue(mockUser);
      usersService.canLogin.mockReturnValue({ allowed: true });
      jwtService.signAsync.mockResolvedValue('new-token');

      // Mock the hash to match what's stored
      const crypto = await import('crypto');
      const expectedHash = crypto
        .createHash('sha256')
        .update(payload.refreshToken)
        .digest('hex');
      refreshTokensRepository.findById.mockResolvedValue({
        ...mockRefreshToken,
        token: expectedHash,
      });

      const result = await authService.refreshTokens(payload);

      expect(result.accessToken).toBe('new-token');
      expect(refreshTokensRepository.revoke).toHaveBeenCalledWith(
        mockRefreshToken.id,
      );
    });

    it('should throw when token is not found', async () => {
      refreshTokensRepository.findById.mockResolvedValue(null);

      await expect(authService.refreshTokens(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw when token is revoked', async () => {
      refreshTokensRepository.findById.mockResolvedValue({
        ...mockRefreshToken,
        revokedAt: new Date(),
      });
      refreshTokensRepository.isTokenValid.mockReturnValue(false);

      await expect(authService.refreshTokens(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke refresh token', async () => {
      refreshTokensRepository.revokeByToken.mockResolvedValue(mockRefreshToken);

      await authService.logout('some-token');

      expect(refreshTokensRepository.revokeByToken).toHaveBeenCalled();
    });
  });

  describe('logoutAll', () => {
    it('should revoke all refresh tokens for user', async () => {
      refreshTokensRepository.revokeAllForUser.mockResolvedValue({ count: 3 });

      const result = await authService.logoutAll(mockUser.id);

      expect(result.revokedCount).toBe(3);
      expect(refreshTokensRepository.revokeAllForUser).toHaveBeenCalledWith(
        mockUser.id,
      );
    });
  });

  describe('getMe', () => {
    it('should return user info', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      subscriptionsService.getUserSubscription.mockResolvedValue({
        plan: { code: 'FREE', name: 'Free' },
      } as never);

      const result = await authService.getMe(mockUser.id);

      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
    });

    it('should throw when user not found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(authService.getMe('non-existent')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ==========================================================================
  // Phase 2: Email Verification & Password Recovery Tests
  // ==========================================================================

  describe('verifyEmail', () => {
    const verifyDto = {
      email: 'test@example.com',
      code: '123456',
    };

    it('should verify email and return tokens for auto-login', async () => {
      const unverifiedUser = {
        ...mockUser,
        emailVerified: false,
        status: UserStatus.PENDING_VERIFICATION,
      };
      const verifiedUser = {
        ...mockUser,
        emailVerified: true,
        status: UserStatus.ACTIVE,
      };

      usersService.findByEmail.mockResolvedValue(unverifiedUser);
      otpService.verify.mockResolvedValue({
        valid: true,
        userId: mockUser.id,
        otpId: 'otp-123',
      });
      usersService.verifyEmail.mockResolvedValue(verifiedUser);
      jwtService.signAsync.mockResolvedValue('mock-token');
      refreshTokensRepository.create.mockResolvedValue(mockRefreshToken);
      subscriptionsService.getUserSubscription.mockResolvedValue({
        plan: { code: 'FREE', name: 'Free' },
      } as never);

      const result = await authService.verifyEmail(verifyDto);

      expect(result.message).toContain('verified successfully');
      expect(result.tokens.accessToken).toBe('mock-token');
      expect(result.user.emailVerified).toBe(true);
      expect(otpService.verify).toHaveBeenCalledWith(
        verifyDto.code,
        mockUser.id,
        OtpType.EMAIL_VERIFICATION,
      );
    });

    it('should throw when email already verified', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser); // Already verified

      await expect(authService.verifyEmail(verifyDto)).rejects.toThrow();
    });

    it('should throw when user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(authService.verifyEmail(verifyDto)).rejects.toThrow();
    });
  });

  describe('resendVerification', () => {
    const resendDto = {
      email: 'test@example.com',
    };

    it('should resend verification email', async () => {
      const unverifiedUser = {
        ...mockUser,
        emailVerified: false,
        status: UserStatus.PENDING_VERIFICATION,
      };

      usersService.findByEmail.mockResolvedValue(unverifiedUser);
      otpService.generate.mockResolvedValue(mockOtpResult);
      mailService.sendTemplate.mockResolvedValue(undefined);

      const result = await authService.resendVerification(resendDto);

      expect(result.message).toContain('verification code');
      expect(mailService.sendTemplate).toHaveBeenCalledWith(
        'email-verification',
        resendDto.email,
        expect.objectContaining({ otpCode: mockOtpResult.code }),
      );
    });

    it('should return success even when user not found (prevent email enumeration)', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await authService.resendVerification(resendDto);

      expect(result.message).toContain('verification code');
      expect(mailService.sendTemplate).not.toHaveBeenCalled();
    });

    it('should throw when email already verified', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser); // Already verified

      await expect(authService.resendVerification(resendDto)).rejects.toThrow();
    });
  });

  describe('forgotPassword', () => {
    const forgotDto = {
      email: 'test@example.com',
    };

    it('should send password reset email', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      otpService.generate.mockResolvedValue(mockOtpResult);
      mailService.sendTemplate.mockResolvedValue(undefined);

      const result = await authService.forgotPassword(forgotDto);

      expect(result.message).toContain('password reset code');
      expect(mailService.sendTemplate).toHaveBeenCalledWith(
        'password-reset',
        forgotDto.email,
        expect.objectContaining({ otpCode: mockOtpResult.code }),
      );
    });

    it('should return success even when user not found (prevent email enumeration)', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await authService.forgotPassword(forgotDto);

      expect(result.message).toContain('password reset code');
      expect(mailService.sendTemplate).not.toHaveBeenCalled();
    });

    it('should not send email for deleted accounts', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        status: UserStatus.DELETED,
      });

      const result = await authService.forgotPassword(forgotDto);

      expect(result.message).toContain('password reset code');
      expect(mailService.sendTemplate).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const resetDto = {
      email: 'test@example.com',
      code: '123456',
      newPassword: 'NewSecurePass123',
    };

    it('should reset password and revoke all sessions', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      otpService.verify.mockResolvedValue({
        valid: true,
        userId: mockUser.id,
        otpId: 'otp-123',
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      usersService.updatePassword.mockResolvedValue(mockUser);
      refreshTokensRepository.revokeAllForUser.mockResolvedValue({ count: 3 });

      const result = await authService.resetPassword(resetDto);

      expect(result.message).toContain('reset successfully');
      expect(otpService.verify).toHaveBeenCalledWith(
        resetDto.code,
        mockUser.id,
        OtpType.PASSWORD_RESET,
      );
      expect(usersService.updatePassword).toHaveBeenCalledWith(
        mockUser.id,
        'new-hashed-password',
      );
      expect(refreshTokensRepository.revokeAllForUser).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('should throw when user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(authService.resetPassword(resetDto)).rejects.toThrow();
    });
  });
});
