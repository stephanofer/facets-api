import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VoucherDocumentDto {
  @ApiProperty({ enum: ['voucher', 'unknown'], example: 'voucher' })
  type: 'voucher' | 'unknown';

  @ApiPropertyOptional({
    description:
      'Confidence score between 0 and 1 for top-level classification.',
    example: 0.93,
  })
  confidence?: number;
}

export class VoucherExtractedFieldsDto {
  @ApiPropertyOptional({ example: 'Supermercado X', nullable: true })
  merchantName: string | null;

  @ApiPropertyOptional({ example: '2026-03-09', nullable: true })
  issuedAt: string | null;

  @ApiPropertyOptional({ example: '123.45', nullable: true })
  totalAmount: string | null;

  @ApiPropertyOptional({ example: 'ARS', nullable: true })
  currency: string | null;

  @ApiPropertyOptional({ example: '21.43', nullable: true })
  taxAmount: string | null;

  @ApiPropertyOptional({ example: 'debit_card', nullable: true })
  paymentMethod: string | null;
}

export class VoucherExtractionDto {
  @ApiPropertyOptional({
    description:
      'Human-readable voucher text when derivable from the model output. Null when only structured fields are available or no reliable text was extracted.',
    nullable: true,
    example: 'Supermercado X\nTOTAL 123.45',
  })
  text: string | null;

  @ApiPropertyOptional({
    type: VoucherExtractedFieldsDto,
    nullable: true,
  })
  fields: VoucherExtractedFieldsDto | null;
}

export class VoucherDiagnosticsDto {
  @ApiProperty({
    description: 'Requested model or route used by the capability.',
    example: 'workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
  })
  model: string;

  @ApiProperty({
    type: [String],
    description: 'Non-fatal warnings returned by the analysis pipeline.',
    example: [],
  })
  warnings: string[];
}

export class VoucherAnalysisResponseDto {
  @ApiProperty({ enum: ['VOUCHER', 'NOT_VOUCHER'], example: 'VOUCHER' })
  status: 'VOUCHER' | 'NOT_VOUCHER';

  @ApiProperty({ type: VoucherDocumentDto })
  document: VoucherDocumentDto;

  @ApiProperty({ type: VoucherExtractionDto })
  extraction: VoucherExtractionDto;

  @ApiProperty({ type: VoucherDiagnosticsDto })
  diagnostics: VoucherDiagnosticsDto;
}
