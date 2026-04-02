import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateOnboardingDto {
  @ApiPropertyOptional({
    description: 'Whether onboarding is complete',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
