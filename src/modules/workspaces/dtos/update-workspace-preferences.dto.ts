import { Transform, type TransformFnParams } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateWorkspacePreferencesDto {
  @ApiPropertyOptional({
    description:
      'Preferred UI locale override for the current user in this workspace',
    example: 'es-AR',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Transform(trimString)
  uiLocale?: string;

  @ApiPropertyOptional({
    description:
      'Preferred date format override for the current user in this workspace',
    example: 'YYYY-MM-DD',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(trimString)
  dateFormat?: string;

  @ApiPropertyOptional({
    description:
      'Dashboard UI preferences owned by the current user in this workspace',
    example: { compact: true },
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  dashboardPreferences?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Report UI preferences owned by the current user in this workspace',
    example: { defaultPeriod: 'month' },
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  reportPreferences?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Transaction UI preferences owned by the current user in this workspace',
    example: { showPending: true },
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  transactionPreferences?: Record<string, unknown>;
}
