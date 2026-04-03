import { Transform, type TransformFnParams } from 'class-transformer';
import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { AccountType } from '@/generated/prisma/client';
import { AccountProfileRequestUnionDto } from '@modules/accounts/dtos/account-profile.dto';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimUppercase({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

function toNumber({ value }: TransformFnParams): unknown {
  if (value === null || value === undefined || value === '') {
    return value;
  }

  return typeof value === 'string' ? Number(value) : value;
}

export class UpdateAccountDto extends AccountProfileRequestUnionDto {
  @ApiPropertyOptional({ example: 'Caja hogar' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trimString)
  name?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  includeInReports?: boolean;

  @ApiPropertyOptional({ example: 'Solo gastos del hogar', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(trimString)
  notes?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;

  @ApiHideProperty()
  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  @Transform(trimUppercase)
  currencyCode?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @ApiHideProperty()
  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  initialBalance?: number;

  @ApiHideProperty()
  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  currentBalanceCached?: number;
}
