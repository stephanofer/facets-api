import { ApiProperty } from '@nestjs/swagger';

export class MeOnboardingResponseDto {
  @ApiProperty({ example: '2026-03-15T10:00:00.000Z', nullable: true })
  onboardingCompletedAt: Date | null;

  @ApiProperty({ example: true })
  needsOnboarding: boolean;
}
