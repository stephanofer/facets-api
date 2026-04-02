import { Transform, type TransformFnParams } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, Matches } from 'class-validator';
import { ThemePreference } from '@/generated/prisma/client';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimAndUppercaseString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Phone number in E.164 format',
    example: '+5491155557777',
  })
  @IsOptional()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone must be a valid E.164 number',
  })
  @Transform(trimString)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Active ISO 3166-1 alpha-2 country code',
    example: 'AR',
  })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/, {
    message: 'Country code must be a valid ISO 3166-1 alpha-2 code',
  })
  @Transform(trimAndUppercaseString)
  countryCode?: string;

  @ApiPropertyOptional({
    description: 'User theme preference',
    enum: ThemePreference,
    example: ThemePreference.DARK,
  })
  @IsOptional()
  @IsEnum(ThemePreference)
  theme?: ThemePreference;
}
