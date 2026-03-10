import { ApiProperty } from '@nestjs/swagger';

export class AnalyzeVoucherUploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Voucher image file (JPEG, PNG, or WebP, max 5MB).',
  })
  file: unknown;
}
