import { Transform, type TransformFnParams, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsNumber, IsOptional, IsString } from 'class-validator';
import { normalizeBalanceDate } from '@modules/account-balances/domain/account-balance-date.utils';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function toNumber({ value }: TransformFnParams): unknown {
  if (value === null || value === undefined || value === '') {
    return value;
  }

  return typeof value === 'string' ? Number(value) : value;
}

function toBalanceDate({ value }: TransformFnParams): unknown {
  if (!value) {
    return value;
  }

  const parsed = value instanceof Date ? value : new Date(value as string);

  return Number.isNaN(parsed.getTime()) ? value : normalizeBalanceDate(parsed);
}

export class CreateAccountReconciliationDto {
  @ApiProperty({ example: '2026-03-26' })
  @Type(() => Date)
  @Transform(toBalanceDate)
  @IsDate()
  date: Date;

  @ApiProperty({ example: 1150 })
  @Transform(toNumber)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  targetBalance: number;

  @ApiPropertyOptional({ example: 'Saldo real del banco', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(trimString)
  reason?: string;
}
