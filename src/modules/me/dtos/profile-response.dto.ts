import { ApiProperty } from '@nestjs/swagger';
import { ThemePreference } from '@/generated/prisma/client';

export class MeProfileResponseDto {
  @ApiProperty({ example: '+5491155557777', nullable: true })
  phone: string | null;

  @ApiProperty({ example: 'AR', nullable: true })
  countryCode: string | null;

  @ApiProperty({
    enum: ThemePreference,
    example: ThemePreference.DARK,
    nullable: true,
  })
  theme: ThemePreference | null;

  @ApiProperty({ example: '2026-03-15T10:00:00.000Z', nullable: true })
  onboardingCompletedAt: Date | null;
}
