import { Transform } from 'class-transformer';
import {
  IsEnum,
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
import { WorkspaceType } from '../../../generated/prisma/client';

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
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  baseCurrencyCode?: string;

  @ApiPropertyOptional({
    description: 'Workspace base language shared by all members',
    example: 'es',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  baseLanguage?: string;

  @ApiPropertyOptional({
    description: 'Workspace-wide default date format',
    example: 'YYYY-MM-DD',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
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
    description: 'Workspace default timezone',
    example: 'America/Argentina/Buenos_Aires',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Workspace default locale',
    example: 'es-AR',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  locale?: string;

  @ApiPropertyOptional({
    description:
      'Representative label shown for the workspace across the product',
    example: 'Casa',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  displayLabel?: string;

  @ApiPropertyOptional({
    description: 'Workspace type used for shared workspace semantics',
    enum: WorkspaceType,
    example: WorkspaceType.FAMILY,
  })
  @IsOptional()
  @IsEnum(WorkspaceType)
  workspaceType?: WorkspaceType;
}
