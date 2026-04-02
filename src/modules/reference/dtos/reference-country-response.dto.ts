import { ApiProperty } from '@nestjs/swagger';

export class ReferenceCountryResponseDto {
  @ApiProperty({ example: 'AR' })
  code: string;

  @ApiProperty({ example: 'Argentina' })
  name: string;

  @ApiProperty({ example: '+54' })
  callingCode: string;

  @ApiProperty({ example: 'ARS' })
  defaultCurrencyCode: string;

  @ApiProperty({ example: 'es-AR' })
  defaultLocale: string;
}
