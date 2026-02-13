import { IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { AccountType } from '../../../generated/prisma/client';

export class QueryAccountDto {
  @ApiPropertyOptional({
    description: 'Filter by account type',
    enum: AccountType,
    example: AccountType.DEBIT_CARD,
  })
  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;

  @ApiPropertyOptional({
    description: 'Include archived accounts (default: false)',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeArchived?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by currency code',
    example: 'USD',
  })
  @IsOptional()
  currencyCode?: string;
}
