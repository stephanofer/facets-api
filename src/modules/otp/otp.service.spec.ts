import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { OtpService } from '@modules/otp/otp.service';
import { OtpRepository } from '@modules/otp/otp.repository';
import { OtpType } from '../../generated/prisma/client';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_CODES, OTP_CONSTANTS } from '@common/constants/app.constants';

describe('OtpService', () => {
  let service: OtpService;
  let repository: jest.Mocked<OtpRepository>;

  const mockUserId = 'user-123';
  const mockOtpCode = '123456';
  const mockOtpId = 'otp-123';

  const createMockOtp = (overrides = {}) => ({
    id: mockOtpId,
    code: mockOtpCode,
    type: OtpType.EMAIL_VERIFICATION,
    userId: mockUserId,
    attempts: 0,
    maxAttempts: OTP_CONSTANTS.MAX_ATTEMPTS,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
    usedAt: null,
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      findActiveOtp: jest.fn(),
      findByCodeAndUser: jest.fn(),
      incrementAttempts: jest.fn(),
      markAsUsed: jest.fn(),
      invalidateAllForUser: jest.fn(),
      countRecentOtps: jest.fn(),
      findMostRecent: jest.fn(),
      deleteExpired: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        {
          provide: OtpRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
    repository = module.get(OtpRepository);
  });

  describe('generate', () => {
    it('should generate a 6-digit OTP code', async () => {
      repository.countRecentOtps.mockResolvedValue(0);
      repository.findMostRecent.mockResolvedValue(null);
      repository.invalidateAllForUser.mockResolvedValue(0);
      repository.create.mockImplementation(async (data) => ({
        id: mockOtpId,
        ...data,
        attempts: 0,
        maxAttempts: OTP_CONSTANTS.MAX_ATTEMPTS,
        usedAt: null,
        createdAt: new Date(),
      }));

      const result = await service.generate(
        mockUserId,
        OtpType.EMAIL_VERIFICATION,
      );

      expect(result.code).toMatch(/^\d{6}$/);
      expect(result.otpId).toBe(mockOtpId);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(repository.invalidateAllForUser).toHaveBeenCalledWith(
        mockUserId,
        OtpType.EMAIL_VERIFICATION,
      );
    });

    it('should throw rate limit error when max OTPs per hour exceeded', async () => {
      repository.countRecentOtps.mockResolvedValue(
        OTP_CONSTANTS.RATE_LIMIT_PER_HOUR,
      );

      await expect(
        service.generate(mockUserId, OtpType.EMAIL_VERIFICATION),
      ).rejects.toThrow(BusinessException);

      try {
        await service.generate(mockUserId, OtpType.EMAIL_VERIFICATION);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_CODES.OTP_RATE_LIMITED,
        );
      }
    });

    it('should throw cooldown error when requested too soon', async () => {
      repository.countRecentOtps.mockResolvedValue(0);
      repository.findMostRecent.mockResolvedValue(
        createMockOtp({
          createdAt: new Date(), // Just created
        }),
      );

      await expect(
        service.generate(mockUserId, OtpType.EMAIL_VERIFICATION),
      ).rejects.toThrow(BusinessException);

      try {
        await service.generate(mockUserId, OtpType.EMAIL_VERIFICATION);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_CODES.OTP_COOLDOWN,
        );
      }
    });

    it('should allow generation after cooldown period', async () => {
      repository.countRecentOtps.mockResolvedValue(0);
      repository.findMostRecent.mockResolvedValue(
        createMockOtp({
          createdAt: new Date(
            Date.now() - (OTP_CONSTANTS.COOLDOWN_SECONDS + 1) * 1000,
          ),
        }),
      );
      repository.invalidateAllForUser.mockResolvedValue(0);
      repository.create.mockImplementation(async (data) => ({
        id: mockOtpId,
        ...data,
        attempts: 0,
        maxAttempts: OTP_CONSTANTS.MAX_ATTEMPTS,
        usedAt: null,
        createdAt: new Date(),
      }));

      const result = await service.generate(
        mockUserId,
        OtpType.EMAIL_VERIFICATION,
      );

      expect(result.code).toMatch(/^\d{6}$/);
    });
  });

  describe('verify', () => {
    it('should verify a valid OTP code', async () => {
      repository.findActiveOtp.mockResolvedValue(createMockOtp());
      repository.markAsUsed.mockResolvedValue(
        createMockOtp({ usedAt: new Date() }),
      );

      const result = await service.verify(
        mockOtpCode,
        mockUserId,
        OtpType.EMAIL_VERIFICATION,
      );

      expect(result.valid).toBe(true);
      expect(result.userId).toBe(mockUserId);
      expect(repository.markAsUsed).toHaveBeenCalledWith(mockOtpId);
    });

    it('should throw error when no active OTP found', async () => {
      repository.findActiveOtp.mockResolvedValue(null);

      await expect(
        service.verify(mockOtpCode, mockUserId, OtpType.EMAIL_VERIFICATION),
      ).rejects.toThrow(BusinessException);

      try {
        await service.verify(
          mockOtpCode,
          mockUserId,
          OtpType.EMAIL_VERIFICATION,
        );
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(ERROR_CODES.INVALID_OTP);
      }
    });

    it('should throw error when OTP is expired', async () => {
      repository.findActiveOtp.mockResolvedValue(
        createMockOtp({
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        }),
      );

      await expect(
        service.verify(mockOtpCode, mockUserId, OtpType.EMAIL_VERIFICATION),
      ).rejects.toThrow(BusinessException);

      try {
        await service.verify(
          mockOtpCode,
          mockUserId,
          OtpType.EMAIL_VERIFICATION,
        );
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(ERROR_CODES.OTP_EXPIRED);
      }
    });

    it('should throw error when max attempts exceeded', async () => {
      repository.findActiveOtp.mockResolvedValue(
        createMockOtp({
          attempts: OTP_CONSTANTS.MAX_ATTEMPTS,
        }),
      );

      await expect(
        service.verify(mockOtpCode, mockUserId, OtpType.EMAIL_VERIFICATION),
      ).rejects.toThrow(BusinessException);

      try {
        await service.verify(
          mockOtpCode,
          mockUserId,
          OtpType.EMAIL_VERIFICATION,
        );
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          ERROR_CODES.OTP_MAX_ATTEMPTS,
        );
        expect((error as BusinessException).getStatus()).toBe(
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    });

    it('should increment attempts on wrong code', async () => {
      repository.findActiveOtp.mockResolvedValue(createMockOtp());
      repository.incrementAttempts.mockResolvedValue(
        createMockOtp({ attempts: 1 }),
      );

      const wrongCode = '000000';

      await expect(
        service.verify(wrongCode, mockUserId, OtpType.EMAIL_VERIFICATION),
      ).rejects.toThrow(BusinessException);

      expect(repository.incrementAttempts).toHaveBeenCalledWith(mockOtpId);
    });

    it('should include remaining attempts in error message', async () => {
      repository.findActiveOtp.mockResolvedValue(
        createMockOtp({ attempts: 3 }),
      );
      repository.incrementAttempts.mockResolvedValue(
        createMockOtp({ attempts: 4 }),
      );

      const wrongCode = '000000';

      try {
        await service.verify(wrongCode, mockUserId, OtpType.EMAIL_VERIFICATION);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).message).toContain('1 attempt(s)');
      }
    });
  });

  describe('getExpiryMinutes', () => {
    it('should return the configured expiry minutes', () => {
      expect(service.getExpiryMinutes()).toBe(OTP_CONSTANTS.EXPIRY_MINUTES);
    });
  });
});
