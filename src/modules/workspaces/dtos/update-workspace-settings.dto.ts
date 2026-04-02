import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimAndUppercaseString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export class UpdateWorkspaceSettingsDto {
  @ApiPropertyOptional({
    description: 'Workspace base currency code shared by all members',
    example: 'ARS',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, {
    message:
      'Base currency code must be a valid ISO 4217 code (e.g., USD, ARS)',
  })
  @Transform(trimAndUppercaseString)
  baseCurrencyCode?: string;

  @ApiPropertyOptional({
    description: 'Workspace content locale shared by all members',
    example: 'es-AR',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  @Transform(trimString)
  contentLocale?: string;

  @ApiPropertyOptional({
    description: 'Workspace-wide default date format',
    example: 'YYYY-MM-DD',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(trimString)
  dateFormat?: string;

  @ApiPropertyOptional({
    description: 'Day of month that starts the financial month',
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  monthStartDay?: number;

  @ApiPropertyOptional({
    description: 'Day of week that starts the calendar week (1-7)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  weekStartDay?: number;

  @ApiPropertyOptional({
    description: 'Workspace financial timezone',
    example: 'America/Argentina/Buenos_Aires',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(trimString)
  financialTimezone?: string;
}
