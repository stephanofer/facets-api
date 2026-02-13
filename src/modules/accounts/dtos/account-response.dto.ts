import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '../../../generated/prisma/client';

export class AccountResponseDto {
  @ApiProperty({ example: 'cm3xk7z9w0001jn08abc12345' })
  id: string;

  @ApiProperty({ example: 'My Checking Account' })
  name: string;

  @ApiProperty({ enum: AccountType, example: AccountType.DEBIT_CARD })
  type: AccountType;

  @ApiProperty({
    example: '1500.5000',
    description: 'Current balance as string for precision',
  })
  balance: string;

  @ApiProperty({ example: 'USD' })
  currencyCode: string;

  @ApiPropertyOptional({ example: '#FF5733' })
  color?: string;

  @ApiPropertyOptional({ example: 'credit-card' })
  icon?: string;

  @ApiProperty({ example: true })
  includeInTotal: boolean;

  @ApiProperty({ example: false })
  isArchived: boolean;

  // Credit card fields
  @ApiPropertyOptional({ example: '5000.0000' })
  creditLimit?: string;

  @ApiPropertyOptional({ example: 15 })
  statementClosingDay?: number;

  @ApiPropertyOptional({ example: 5 })
  paymentDueDay?: number;

  @ApiProperty({ example: 0 })
  sortOrder: number;

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  updatedAt: Date;
}

export class AccountListResponseDto {
  @ApiProperty({ type: [AccountResponseDto] })
  accounts: AccountResponseDto[];

  @ApiProperty({
    example: 3,
    description: 'Total number of active (non-archived) accounts',
  })
  total: number;
}

export class AccountBalanceSummaryDto {
  @ApiProperty({ example: 'USD' })
  currencyCode: string;

  @ApiProperty({
    example: '5500.0000',
    description: 'Sum of all account balances in this currency',
  })
  totalBalance: string;

  @ApiProperty({
    example: 2,
    description: 'Number of accounts in this currency',
  })
  accountCount: number;
}

export class AccountSummaryResponseDto {
  @ApiProperty({ type: [AccountBalanceSummaryDto] })
  balances: AccountBalanceSummaryDto[];

  @ApiProperty({ example: 5, description: 'Total number of active accounts' })
  totalAccounts: number;
}
