import { Transform, type TransformFnParams } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateAccountDto extends AccountProfileRequestUnionDto {
  @ApiProperty({ example: 'Banco sueldo' })
  @IsString()
  @MaxLength(120)
  @Transform(trimString)
  name: string;

  @ApiProperty({ enum: AccountType, example: AccountType.BANK })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiProperty({ example: 'ARS' })
  @Matches(/^[A-Z]{3}$/, {
    message: 'currencyCode must be a valid ISO 4217 code',
  })
  @Transform(trimUppercase)
  currencyCode: string;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  initialBalance?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  includeInReports?: boolean;

  @ApiPropertyOptional({
    example: 'Cuenta principal del trabajo',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Transform(trimString)
  notes?: string;
}
