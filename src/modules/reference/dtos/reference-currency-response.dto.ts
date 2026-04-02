import { ApiProperty } from '@nestjs/swagger';

export class ReferenceCurrencyResponseDto {
  @ApiProperty({ example: 'USD' })
  code: string;

  @ApiProperty({ example: 'US Dollar' })
  name: string;

  @ApiProperty({ example: '$' })
  symbol: string;

  @ApiProperty({ example: 2 })
  decimalScale: number;
}
