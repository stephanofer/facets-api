import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { APP_CONSTANTS } from '@common/constants/app.constants';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(APP_CONSTANTS.MIN_PAGE_SIZE)
  @Max(APP_CONSTANTS.MAX_PAGE_SIZE)
  limit: number = APP_CONSTANTS.DEFAULT_PAGE_SIZE;
}
