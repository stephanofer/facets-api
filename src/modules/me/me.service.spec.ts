/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { BusinessException } from '@common/exceptions/business.exception';
import { MeRepository } from '@modules/me/me.repository';
import { MeService } from '@modules/me/me.service';
import { ThemePreference } from '@/generated/prisma/client';

describe('MeService', () => {
  let service: MeService;
  let moduleRef: TestingModule;
  let repository: jest.Mocked<MeRepository>;

  const userId = 'user-id';
  const onboardingCompletedAt = new Date('2026-03-18T15:30:00.000Z');

  const profileRecord = {
    id: 'profile-id',
    userId,
    phone: '+5491155557777',
    avatarUrl: null,
    avatarStorageKey: null,
    theme: ThemePreference.DARK,
    countryCode: 'AR',
    onboardingCompletedAt,
    createdAt: new Date('2026-03-18T15:00:00.000Z'),
    updatedAt: new Date('2026-03-18T15:30:00.000Z'),
  };

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        MeService,
        {
          provide: MeRepository,
          useValue: {
            findProfileByUserId: jest.fn(),
            findActiveCountryByCode: jest.fn(),
            upsertProfile: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(MeService);
    repository = moduleRef.get(MeRepository);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('returns the stored profile resource', async () => {
    repository.findProfileByUserId.mockResolvedValue(profileRecord);

    const result = await service.getProfile(userId);

    expect(result).toEqual({
      phone: '+5491155557777',
      countryCode: 'AR',
      theme: ThemePreference.DARK,
      onboardingCompletedAt,
    });
  });

  it('returns a stable empty profile shape when no profile row exists', async () => {
    repository.findProfileByUserId.mockResolvedValue(null);

    const result = await service.getProfile(userId);

    expect(result).toEqual({
      phone: null,
      countryCode: null,
      theme: null,
      onboardingCompletedAt: null,
    });
  });

  it('updates profile fields after validating an active country', async () => {
    repository.findActiveCountryByCode.mockResolvedValue({
      code: 'AR',
      isActive: true,
    } as never);
    repository.upsertProfile.mockResolvedValue({
      ...profileRecord,
      phone: '+5491177778888',
      theme: ThemePreference.LIGHT,
    });

    const result = await service.updateProfile(userId, {
      phone: '+5491177778888',
      countryCode: 'AR',
      theme: ThemePreference.LIGHT,
    });

    expect(repository.findActiveCountryByCode).toHaveBeenCalledWith('AR');
    expect(repository.upsertProfile).toHaveBeenCalledWith(userId, {
      phone: '+5491177778888',
      countryCode: 'AR',
      theme: ThemePreference.LIGHT,
    });
    expect(result.theme).toBe(ThemePreference.LIGHT);
  });

  it('rejects profile updates when the country is inactive or unknown', async () => {
    repository.findActiveCountryByCode.mockResolvedValue(null);

    await expect(
      service.updateProfile(userId, {
        countryCode: 'BR',
      }),
    ).rejects.toThrow(BusinessException);

    expect(repository.upsertProfile).not.toHaveBeenCalled();
  });

  it('returns onboarding state with needsOnboarding=true when completion is missing', async () => {
    repository.findProfileByUserId.mockResolvedValue({
      ...profileRecord,
      onboardingCompletedAt: null,
    });

    const result = await service.getOnboarding(userId);

    expect(result).toEqual({
      onboardingCompletedAt: null,
      needsOnboarding: true,
    });
  });

  it('marks onboarding complete without mutating country ownership', async () => {
    repository.findProfileByUserId.mockResolvedValue(null);
    repository.upsertProfile.mockResolvedValue({
      ...profileRecord,
      countryCode: null,
      onboardingCompletedAt,
    });

    const result = await service.updateOnboarding(userId, {
      completed: true,
    });

    const upsertCall = repository.upsertProfile.mock.calls[0];

    expect(upsertCall?.[0]).toBe(userId);
    expect(upsertCall?.[1].onboardingCompletedAt).toBeInstanceOf(Date);
    expect(result.needsOnboarding).toBe(false);
    expect(result.onboardingCompletedAt).not.toBeNull();
    expect(result).not.toHaveProperty('countryCode');
  });
});
