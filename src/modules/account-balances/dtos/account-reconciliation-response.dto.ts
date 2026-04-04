import { ApiProperty } from '@nestjs/swagger';
import { AccountReconciliationAuthorDto } from '@modules/account-balances/dtos/account-reconciliation-author.dto';

export class AccountReconciliationResponseDto {
  @ApiProperty({ example: 'crec_123456789' })
  id: string;

  @ApiProperty({ example: 'cacc_123456789' })
  accountId: string;

  @ApiProperty({ example: '2026-03-26' })
  date: string;

  @ApiProperty({ example: '1150' })
  targetBalance: string;

  @ApiProperty({ example: 'Saldo real del banco', nullable: true })
  reason: string | null;

  @ApiProperty({ example: true })
  isEffective: boolean;

  @ApiProperty({
    type: AccountReconciliationAuthorDto,
    nullable: true,
  })
  author: AccountReconciliationAuthorDto | null;

  @ApiProperty({ example: '2026-03-26T10:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-03-26T10:00:00.000Z' })
  updatedAt: string;
}
