import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { ThemePreference, UserProfile } from '@/generated/prisma/client';

export interface MeProfileUpsertData {
  phone?: string | null;
  countryCode?: string | null;
  theme?: ThemePreference;
  onboardingCompletedAt?: Date | null;
}

@Injectable()
export class MeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findProfileByUserId(userId: string): Promise<UserProfile | null> {
    return this.prisma.userProfile.findUnique({
      where: { userId },
    });
  }

  async findActiveCountryByCode(code: string) {
    return this.prisma.country.findFirst({
      where: {
        code,
        isActive: true,
      },
    });
  }

  async upsertProfile(
    userId: string,
    data: MeProfileUpsertData,
  ): Promise<UserProfile> {
    return this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.countryCode !== undefined
          ? { countryCode: data.countryCode }
          : {}),
        ...(data.theme !== undefined ? { theme: data.theme } : {}),
        ...(data.onboardingCompletedAt !== undefined
          ? { onboardingCompletedAt: data.onboardingCompletedAt }
          : {}),
      },
      update: data,
    });
  }
}
