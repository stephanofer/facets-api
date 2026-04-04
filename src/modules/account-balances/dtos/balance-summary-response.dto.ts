import { ApiProperty } from '@nestjs/swagger';

export class BalanceSummaryResponseDto {
  @ApiProperty({ example: 'cacc_123456789' })
  accountId: string;

  @ApiProperty({ example: 'ARS' })
  currencyCode: string;

  @ApiProperty({ example: '1150' })
  currentBalance: string;

  @ApiProperty({ example: '1200' })
  calculatedBalance: string;

  @ApiProperty({ example: '1150' })
  reconciledBalance: string;

  @ApiProperty({ example: '-50' })
  difference: string;

  @ApiProperty({ example: true })
  hasDifference: boolean;

  @ApiProperty({ example: '2026-03-26', nullable: true })
  lastSnapshotDate: string | null;
}
