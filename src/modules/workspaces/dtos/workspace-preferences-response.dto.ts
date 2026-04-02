import { ApiProperty } from '@nestjs/swagger';

export class WorkspacePreferencesResponseDto {
  @ApiProperty({ example: 'es-AR', nullable: true })
  uiLocale: string | null;

  @ApiProperty({ example: 'YYYY-MM-DD', nullable: true })
  dateFormat: string | null;

  @ApiProperty({ example: { compact: true }, additionalProperties: true })
  dashboardPreferences: Record<string, unknown>;

  @ApiProperty({
    example: { defaultPeriod: 'month' },
    additionalProperties: true,
  })
  reportPreferences: Record<string, unknown>;

  @ApiProperty({ example: { showPending: true }, additionalProperties: true })
  transactionPreferences: Record<string, unknown>;
}
