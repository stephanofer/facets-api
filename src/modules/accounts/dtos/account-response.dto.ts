import { ApiProperty } from '@nestjs/swagger';
import { AccountStatus, AccountType } from '@/generated/prisma/client';
import { AccountProfileResponseUnionDto } from '@modules/accounts/dtos/account-profile.dto';

export class AccountResponseDto extends AccountProfileResponseUnionDto {
  @ApiProperty({ example: 'cacc_123456789' })
  id: string;

  @ApiProperty({ example: 'Banco sueldo' })
  name: string;

  @ApiProperty({ enum: AccountType, example: AccountType.BANK })
  type: AccountType;

  @ApiProperty({ example: 'ARS' })
  currencyCode: string;

  @ApiProperty({ enum: AccountStatus, example: AccountStatus.ACTIVE })
  status: AccountStatus;

  @ApiProperty({ example: true })
  includeInReports: boolean;

  @ApiProperty({ example: 'Cuenta principal', nullable: true })
  notes: string | null;

  @ApiProperty({ example: '2026-04-03T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-04-03T12:00:00.000Z' })
  updatedAt: Date;
}
