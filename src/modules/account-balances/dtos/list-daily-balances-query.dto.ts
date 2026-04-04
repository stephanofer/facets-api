import { Transform, type TransformFnParams, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsOptional } from 'class-validator';
import { normalizeBalanceDate } from '@modules/account-balances/domain/account-balance-date.utils';

function toBalanceDate({ value }: TransformFnParams): unknown {
  if (!value) {
    return value;
  }

  const parsed = value instanceof Date ? value : new Date(value as string);

  return Number.isNaN(parsed.getTime()) ? value : normalizeBalanceDate(parsed);
}

export class ListDailyBalancesQueryDto {
  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @Type(() => Date)
  @Transform(toBalanceDate)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @Type(() => Date)
  @Transform(toBalanceDate)
  @IsDate()
  to?: Date;
}
