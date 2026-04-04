import { ApiProperty } from '@nestjs/swagger';

export class DailyBalanceTimelineItemDto {
  @ApiProperty({ example: '2026-03-26' })
  date: string;

  @ApiProperty({ example: '1200' })
  openingBalance: string;

  @ApiProperty({ example: '0' })
  inflowsAmount: string;

  @ApiProperty({ example: '50' })
  outflowsAmount: string;

  @ApiProperty({ example: '-50' })
  adjustmentsAmount: string;

  @ApiProperty({ example: '1150' })
  closingBalance: string;

  @ApiProperty({ example: '1200' })
  calculatedBalance: string;

  @ApiProperty({ example: '1150' })
  reconciledBalance: string;

  @ApiProperty({ example: '-50' })
  difference: string;
}
