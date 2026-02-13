import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  MaxLength,
  Min,
  Max,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AccountType } from '../../../generated/prisma/client';

export class CreateAccountDto {
  @ApiProperty({
    description: 'Account name',
    example: 'My Checking Account',
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Account type',
    enum: AccountType,
    example: AccountType.DEBIT_CARD,
  })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiPropertyOptional({
    description: 'Initial balance (defaults to 0)',
    example: 1500.5,
    default: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Type(() => Number)
  balance?: number;

  @ApiPropertyOptional({
    description: 'ISO 4217 currency code',
    example: 'USD',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, {
    message: 'Currency code must be a valid ISO 4217 code (e.g., USD, EUR)',
  })
  currencyCode?: string;

  @ApiPropertyOptional({
    description: 'Hex color code for UI',
    example: '#FF5733',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid hex color (e.g., #FF5733)',
  })
  color?: string;

  @ApiPropertyOptional({
    description: 'Icon identifier for the app UI',
    example: 'credit-card',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({
    description: 'Include this account in the dashboard total balance',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeInTotal?: boolean;

  // Credit card specific fields
  @ApiPropertyOptional({
    description: 'Credit limit (only for CREDIT_CARD type)',
    example: 5000,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  creditLimit?: number;

  @ApiPropertyOptional({
    description: 'Statement closing day of month (1-31, only for CREDIT_CARD)',
    example: 15,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  @Type(() => Number)
  statementClosingDay?: number;

  @ApiPropertyOptional({
    description: 'Payment due day of month (1-31, only for CREDIT_CARD)',
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  @Type(() => Number)
  paymentDueDay?: number;

  @ApiPropertyOptional({
    description: 'Display order (lower = first)',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;
}
