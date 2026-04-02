import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import {
  UserProfile,
  WorkspaceSettings,
  ThemePreference,
} from '@/generated/prisma/client';

export interface AuthBootstrapProfileSummary {
  countryCode: string | null;
  theme: ThemePreference | null;
  onboardingCompletedAt: Date | null;
}

export interface AuthBootstrapContext {
  workspaceSettings: WorkspaceSettings;
  profile: UserProfile | null;
}

@Injectable()
export class AuthBootstrapRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBootstrapContext(
    userId: string,
    workspaceId: string,
  ): Promise<AuthBootstrapContext> {
    const [workspaceSettings, profile] = await Promise.all([
      this.prisma.workspaceSettings.findUniqueOrThrow({
        where: { workspaceId },
      }),
      this.prisma.userProfile.findUnique({
        where: { userId },
      }),
    ]);

    return {
      workspaceSettings,
      profile,
    };
  }
}
