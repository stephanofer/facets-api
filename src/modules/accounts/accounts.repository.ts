import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { Account, AccountType, Prisma } from '../../generated/prisma/client';

export interface AccountQueryFilters {
  userId: string;
  type?: AccountType;
  includeArchived?: boolean;
  currencyCode?: string;
}

@Injectable()
export class AccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new account
   */
  async create(data: Prisma.AccountUncheckedCreateInput): Promise<Account> {
    return this.prisma.account.create({ data });
  }

  /**
   * Find account by ID (owned by user)
   */
  async findById(id: string, userId: string): Promise<Account | null> {
    return this.prisma.account.findFirst({
      where: { id, userId },
    });
  }

  /**
   * Find all accounts for a user with filters
   */
  async findAll(filters: AccountQueryFilters): Promise<Account[]> {
    const where: Prisma.AccountWhereInput = {
      userId: filters.userId,
    };

    if (!filters.includeArchived) {
      where.isArchived = false;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.currencyCode) {
      where.currencyCode = filters.currencyCode;
    }

    return this.prisma.account.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Update an account
   */
  async update(
    id: string,
    userId: string,
    data: Prisma.AccountUncheckedUpdateInput,
  ): Promise<Account> {
    return this.prisma.account.update({
      where: { id },
      data: { ...data, userId },
    });
  }

  /**
   * Hard delete an account (only if it has no transactions)
   */
  async delete(id: string): Promise<void> {
    await this.prisma.account.delete({ where: { id } });
  }

  /**
   * Archive/unarchive an account
   */
  async setArchived(
    id: string,
    userId: string,
    isArchived: boolean,
  ): Promise<Account> {
    return this.prisma.account.update({
      where: { id },
      data: { isArchived, userId },
    });
  }

  /**
   * Count active (non-archived) accounts for a user
   * Used by FeatureGuard for RESOURCE limit checks
   */
  async countActive(userId: string): Promise<number> {
    return this.prisma.account.count({
      where: { userId, isArchived: false },
    });
  }

  /**
   * Check if an account has any transactions
   */
  async hasTransactions(id: string): Promise<boolean> {
    const count = await this.prisma.transaction.count({
      where: {
        OR: [{ accountId: id }, { transferToAccountId: id }],
      },
    });
    return count > 0;
  }

  /**
   * Check if account name already exists for user (case-insensitive)
   */
  async nameExists(
    userId: string,
    name: string,
    excludeId?: string,
  ): Promise<boolean> {
    const where: Prisma.AccountWhereInput = {
      userId,
      name: { equals: name, mode: 'insensitive' },
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const count = await this.prisma.account.count({ where });
    return count > 0;
  }

  /**
   * Get balance summary grouped by currency
   */
  async getBalanceSummary(userId: string): Promise<
    {
      currencyCode: string;
      _sum: { balance: Prisma.Decimal | null };
      _count: number;
    }[]
  > {
    const result = await this.prisma.account.groupBy({
      by: ['currencyCode'],
      where: { userId, isArchived: false, includeInTotal: true },
      _sum: { balance: true },
      _count: true,
    });
    return result;
  }

  /**
   * Verify currency code exists in the currencies table
   */
  async currencyExists(code: string): Promise<boolean> {
    const currency = await this.prisma.currency.findUnique({
      where: { code },
    });
    return currency !== null && currency.isActive;
  }
}
