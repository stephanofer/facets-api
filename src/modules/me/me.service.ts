import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@common/constants/app.constants';
import { BusinessException } from '@common/exceptions/business.exception';
import { MeOnboardingResponseDto } from '@modules/me/dtos/onboarding-response.dto';
import { MeProfileResponseDto } from '@modules/me/dtos/profile-response.dto';
import { UpdateOnboardingDto } from '@modules/me/dtos/update-onboarding.dto';
import { UpdateProfileDto } from '@modules/me/dtos/update-profile.dto';
import { MeRepository } from '@modules/me/me.repository';

@Injectable()
export class MeService {
  constructor(private readonly meRepository: MeRepository) {}

  async getProfile(userId: string): Promise<MeProfileResponseDto> {
    const profile = await this.meRepository.findProfileByUserId(userId);

    return {
      phone: profile?.phone ?? null,
      countryCode: profile?.countryCode ?? null,
      theme: profile?.theme ?? null,
      onboardingCompletedAt: profile?.onboardingCompletedAt ?? null,
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<MeProfileResponseDto> {
    await this.ensureCountryIsActive(dto.countryCode);

    const profile = await this.meRepository.upsertProfile(userId, {
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.countryCode !== undefined
        ? { countryCode: dto.countryCode }
        : {}),
      ...(dto.theme !== undefined ? { theme: dto.theme } : {}),
    });

    return {
      phone: profile.phone ?? null,
      countryCode: profile.countryCode ?? null,
      theme: profile.theme,
      onboardingCompletedAt: profile.onboardingCompletedAt ?? null,
    };
  }

  async getOnboarding(userId: string): Promise<MeOnboardingResponseDto> {
    const profile = await this.meRepository.findProfileByUserId(userId);

    return this.toOnboardingResponse(profile?.onboardingCompletedAt ?? null);
  }

  async updateOnboarding(
    userId: string,
    dto: UpdateOnboardingDto,
  ): Promise<MeOnboardingResponseDto> {
    const currentProfile = await this.meRepository.findProfileByUserId(userId);
    const nextOnboardingCompletedAt =
      dto.completed === undefined
        ? (currentProfile?.onboardingCompletedAt ?? null)
        : dto.completed
          ? (currentProfile?.onboardingCompletedAt ?? new Date())
          : null;

    const profile = await this.meRepository.upsertProfile(userId, {
      onboardingCompletedAt: nextOnboardingCompletedAt,
    });

    return this.toOnboardingResponse(profile.onboardingCompletedAt ?? null);
  }

  private async ensureCountryIsActive(countryCode?: string): Promise<void> {
    if (!countryCode) {
      return;
    }

    const country =
      await this.meRepository.findActiveCountryByCode(countryCode);

    if (!country) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION_ERROR,
        'Country must be active and valid',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private toOnboardingResponse(
    onboardingCompletedAt: Date | null,
  ): MeOnboardingResponseDto {
    return {
      onboardingCompletedAt,
      needsOnboarding: onboardingCompletedAt == null,
    };
  }
}
