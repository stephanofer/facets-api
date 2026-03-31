/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { AuthService } from '@modules/auth/auth.service';
import { RefreshTokensRepository } from '@modules/auth/refresh-tokens.repository';
import { ConfigService } from '@config/config.service';
import { PrismaService } from '@database/prisma.service';
import { MailService } from '@mail/mail.service';
import { OtpService } from '@modules/otp/otp.service';
import { UsersService } from '@modules/users/users.service';
import { FileService } from '@storage/services/file.service';
import {
  OtpType,
  PlatformRole,
  UserStatus,
  WorkspaceMembershipStatus,
  WorkspaceRole,
  WorkspaceStatus,
  WorkspaceType,
} from '../../generated/prisma/client';

jest.mock('argon2');

describe('AuthService', () => {
  let authService: AuthService;
  let moduleRef: TestingModule;
  let usersService: jest.Mocked<UsersService>;
  let refreshTokensRepository: jest.Mocked<RefreshTokensRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let otpService: jest.Mocked<OtpService>;
  let mailService: jest.Mocked<MailService>;
  let prismaService: jest.Mocked<PrismaService>;
  let fileService: jest.Mocked<FileService>;

  const mockWorkspace = {
    id: 'workspace-id',
    name: 'Test User Workspace',
    slug: null,
    type: WorkspaceType.PERSONAL,
    status: WorkspaceStatus.ACTIVE,
    financialDataUpdatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    password: 'hashed-password',
    firstName: 'Test',
    lastName: 'User',
    emailVerified: true,
    emailVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    platformRole: PlatformRole.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockMembership = {
    id: 'membership-id',
    workspaceId: mockWorkspace.id,
    userId: mockUser.id,
    role: WorkspaceRole.ADMIN,
    status: WorkspaceMembershipStatus.ACTIVE,
    invitedAt: null,
    joinedAt: new Date(),
    invitedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    workspace: mockWorkspace,
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

  const mockAvatar = {
    avatarUrl: 'https://cdn.facets.test/avatars/file-1.png',
    avatarStorageKey: 'avatars/file-1.png',
  };

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
            findByEmail: jest.fn(),
            emailExists: jest.fn(),
            verifyEmail: jest.fn(),
            updatePassword: jest.fn(),
            findAvatarByUserId: jest.fn(),
            replaceAvatar: jest.fn(),
            removeAvatar: jest.fn(),
            canLogin: jest.fn(),
          },
        },
        {
          provide: RefreshTokensRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            revoke: jest.fn(),
            revokeByToken: jest.fn(),
            revokeAllForUser: jest.fn(),
            isTokenValid: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            jwt: {
              accessSecret: 'test-access-secret',
              refreshSecret: 'test-refresh-secret',
              accessExpires: '1h',
              refreshExpires: '7d',
            },
            isProduction: false,
            cookie: {
              refreshTokenPath: '/api/v1/auth/refresh',
            },
          },
        },
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
            workspaceMembership: {
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: OtpService,
          useValue: {
            generate: jest.fn(),
            verify: jest.fn(),
            getExpiryMinutes: jest.fn().mockReturnValue(10),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendTemplate: jest.fn(),
          },
        },
        {
          provide: FileService,
          useValue: {
            uploadPublicObject: jest.fn(),
            deleteObject: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
    usersService = moduleRef.get(UsersService);
    refreshTokensRepository = moduleRef.get(RefreshTokensRepository);
    jwtService = moduleRef.get(JwtService);
    otpService = moduleRef.get(OtpService);
    mailService = moduleRef.get(MailService);
    prismaService = moduleRef.get(PrismaService);
    fileService = moduleRef.get(FileService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  describe('register', () => {
    const registerDto = {
      email: 'new@example.com',
      password: 'SecurePass123',
      firstName: 'New',
      lastName: 'User',
    };

    it('should register a new user successfully with workspace bootstrap', async () => {
      const createdUser = {
        ...mockUser,
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        status: UserStatus.PENDING_VERIFICATION,
        emailVerified: false,
      };

      usersService.emailExists.mockResolvedValue(false);
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');
      prismaService.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          workspace: {
            create: jest.fn().mockResolvedValue(mockWorkspace),
          },
          user: {
            create: jest.fn().mockResolvedValue(createdUser),
          },
          workspaceMembership: {
            create: jest.fn().mockResolvedValue({
              ...mockMembership,
              userId: createdUser.id,
            }),
          },
          workspaceSettings: {
            create: jest.fn().mockResolvedValue({ id: 'settings-id' }),
          },
        };

        return callback(tx);
      });
      otpService.generate.mockResolvedValue(mockOtpResult);
      mailService.sendTemplate.mockResolvedValue(undefined);

      const result = await authService.register(registerDto);

      expect(result.message).toContain('Registration successful');
      expect(result.user.workspace.id).toBe(mockWorkspace.id);
      expect(result.user.membership.role).toBe(WorkspaceRole.ADMIN);
      expect(result.user.platformRole).toBe(PlatformRole.USER);
      expect(result.user).not.toHaveProperty('plan');
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

    it('should login successfully with workspace context', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      usersService.canLogin.mockReturnValue({ allowed: true });
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (
        prismaService.workspaceMembership.findFirst as jest.Mock
      ).mockResolvedValue(mockMembership as never);
      jwtService.signAsync.mockResolvedValue('mock-token');
      refreshTokensRepository.create.mockResolvedValue(
        mockRefreshToken as never,
      );

      const result = await authService.login(loginDto);

      expect(result.tokens.accessToken).toBe('mock-token');
      expect(result.user.workspace.id).toBe(mockWorkspace.id);
      expect(result.user.membership.id).toBe(mockMembership.id);
      expect(result.user).not.toHaveProperty('plan');
    });

    it('should deny login when no active workspace membership exists', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      usersService.canLogin.mockReturnValue({ allowed: true });
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (
        prismaService.workspaceMembership.findFirst as jest.Mock
      ).mockResolvedValue(null);

      await expect(authService.login(loginDto)).rejects.toThrow();
    });
  });

  describe('refreshTokens', () => {
    const payload = {
      sub: mockUser.id,
      email: mockUser.email,
      workspaceId: mockWorkspace.id,
      membershipId: mockMembership.id,
      workspaceRole: WorkspaceRole.ADMIN,
      platformRole: PlatformRole.USER,
      tokenId: mockRefreshToken.id,
      refreshToken: 'original-token',
    };

    it('should refresh tokens while preserving workspace claims', async () => {
      const expectedHash = require('crypto')
        .createHash('sha256')
        .update(payload.refreshToken)
        .digest('hex');

      refreshTokensRepository.findById.mockResolvedValue({
        ...mockRefreshToken,
        token: expectedHash,
      } as never);
      refreshTokensRepository.isTokenValid.mockReturnValue(true);
      refreshTokensRepository.revoke.mockResolvedValue(
        mockRefreshToken as never,
      );
      usersService.findById.mockResolvedValue(mockUser);
      usersService.canLogin.mockReturnValue({ allowed: true });
      (
        prismaService.workspaceMembership.findFirst as jest.Mock
      ).mockResolvedValue(mockMembership as never);
      jwtService.signAsync.mockResolvedValue('new-token');
      refreshTokensRepository.create.mockResolvedValue(
        mockRefreshToken as never,
      );

      const result = await authService.refreshTokens(payload);

      expect(result.accessToken).toBe('new-token');
      expect(refreshTokensRepository.revoke).toHaveBeenCalledWith(
        mockRefreshToken.id,
      );
    });

    it('should deny refresh when membership is no longer active', async () => {
      const expectedHash = require('crypto')
        .createHash('sha256')
        .update(payload.refreshToken)
        .digest('hex');

      refreshTokensRepository.findById.mockResolvedValue({
        ...mockRefreshToken,
        token: expectedHash,
      } as never);
      refreshTokensRepository.isTokenValid.mockReturnValue(true);
      refreshTokensRepository.revoke.mockResolvedValue(
        mockRefreshToken as never,
      );
      usersService.findById.mockResolvedValue(mockUser);
      (
        prismaService.workspaceMembership.findFirst as jest.Mock
      ).mockResolvedValue(null);

      await expect(authService.refreshTokens(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getMe', () => {
    it('should return workspace-aware user info', async () => {
      usersService.findAvatarByUserId.mockResolvedValue(null);

      const result = await authService.getMe({
        sub: mockUser.id,
        email: mockUser.email,
        workspaceId: mockWorkspace.id,
        actorUserId: mockUser.id,
        membershipId: mockMembership.id,
        workspaceRole: WorkspaceRole.ADMIN,
        platformRole: PlatformRole.USER,
        user: mockUser,
        workspace: mockWorkspace,
        membership: mockMembership,
      });

      expect(result.workspace.id).toBe(mockWorkspace.id);
      expect(result.membership.role).toBe(WorkspaceRole.ADMIN);
      expect(result).not.toHaveProperty('plan');
    });
  });

  describe('uploadAvatar', () => {
    const uploadFile = {
      fieldname: 'file',
      originalname: 'avatar.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: 128,
      destination: '',
      filename: '',
      path: '',
      stream: undefined,
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    } as unknown as Express.Multer.File;

    it('should upload avatar using workspace-aware ownership metadata', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      usersService.replaceAvatar.mockResolvedValue({
        avatar: mockAvatar,
        previousAvatarStorageKey: null,
      } as never);
      fileService.uploadPublicObject.mockResolvedValue({
        bucket: 'facets-public',
        key: mockAvatar.avatarStorageKey,
        mimeType: 'image/png',
        size: 128,
        publicUrl: mockAvatar.avatarUrl,
      });

      const result = await authService.uploadAvatar(
        {
          sub: mockUser.id,
          email: mockUser.email,
          workspaceId: mockWorkspace.id,
          actorUserId: mockUser.id,
          membershipId: mockMembership.id,
          workspaceRole: WorkspaceRole.ADMIN,
          platformRole: PlatformRole.USER,
          user: mockUser,
          workspace: mockWorkspace,
          membership: mockMembership,
        },
        uploadFile,
      );

      expect(fileService.uploadPublicObject).toHaveBeenCalledWith(
        uploadFile,
        'avatars',
      );
      expect(result.avatarUrl).toBe(mockAvatar.avatarUrl);
      expect(result).not.toHaveProperty('plan');
    });
  });

  describe('verifyEmail', () => {
    it('should verify email and return workspace-aware tokens', async () => {
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
      } as never);
      usersService.verifyEmail.mockResolvedValue(verifiedUser);
      (
        prismaService.workspaceMembership.findFirst as jest.Mock
      ).mockResolvedValue(mockMembership as never);
      jwtService.signAsync.mockResolvedValue('mock-token');
      refreshTokensRepository.create.mockResolvedValue(
        mockRefreshToken as never,
      );

      const result = await authService.verifyEmail({
        email: 'test@example.com',
        code: '123456',
      });

      expect(result.user.workspace.id).toBe(mockWorkspace.id);
      expect(result.tokens.accessToken).toBe('mock-token');
      expect(result.user).not.toHaveProperty('plan');
      expect(otpService.verify).toHaveBeenCalledWith(
        '123456',
        mockUser.id,
        OtpType.EMAIL_VERIFICATION,
      );
    });
  });
});
