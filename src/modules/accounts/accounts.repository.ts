import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { Account, AccountType, Prisma } from '../../generated/prisma/client';

export interface AccountQueryFilters {
  workspaceId: string;
  type?: AccountType;
  includeArchived?: boolean;
  currencyCode?: string;
}

export interface AccountActorCreateData
  extends Prisma.AccountUncheckedCreateInput {
  createdByUserId?: string;
  updatedByUserId?: string;
}

export interface AccountActorUpdateData
  extends Prisma.AccountUncheckedUpdateInput {
  updatedByUserId?: string;
}

@Injectable()
export class AccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new account
   */
  async create(data: AccountActorCreateData): Promise<Account> {
    return this.prisma.account.create({
      data: data as Prisma.AccountUncheckedCreateInput,
    });
  }

  /**
   * Find account by ID within a workspace
   */
  async findById(id: string, workspaceId: string): Promise<Account | null> {
    return this.prisma.account.findFirst({
      where: { id, workspaceId },
    });
  }

  /**
   * Find all accounts for a workspace with filters
   */
  async findAll(filters: AccountQueryFilters): Promise<Account[]> {
    const where: Prisma.AccountWhereInput = {
      workspaceId: filters.workspaceId,
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
    workspaceId: string,
    data: AccountActorUpdateData,
  ): Promise<Account> {
    const [, account] = await this.prisma.$transaction([
      this.prisma.account.updateMany({
        where: { id, workspaceId },
        data: data as Prisma.AccountUncheckedUpdateInput,
      }),
      this.prisma.account.findFirstOrThrow({
        where: { id, workspaceId },
      }),
    ]);

    return account;
  }

  /**
   * Hard delete an account (only if it has no transactions)
   */
  async delete(id: string, workspaceId: string): Promise<void> {
    await this.prisma.account.deleteMany({ where: { id, workspaceId } });
  }

  /**
   * Archive/unarchive an account
   */
  async setArchived(
    id: string,
    workspaceId: string,
    isArchived: boolean,
    updatedByUserId?: string,
  ): Promise<Account> {
    const [, account] = await this.prisma.$transaction([
      this.prisma.account.updateMany({
        where: { id, workspaceId },
        data: {
          isArchived,
          ...(updatedByUserId ? { updatedByUserId } : {}),
        } as Prisma.AccountUncheckedUpdateInput,
      }),
      this.prisma.account.findFirstOrThrow({
        where: { id, workspaceId },
      }),
    ]);

    return account;
  }

  /**
   * Count active (non-archived) accounts for a workspace
   * Used by FeatureGuard for RESOURCE limit checks
   */
  async countActive(workspaceId: string): Promise<number> {
    return this.prisma.account.count({
      where: { workspaceId, isArchived: false },
    });
  }

  /**
   * Check if an account has any transactions
   */
  async hasTransactions(id: string, workspaceId: string): Promise<boolean> {
    const count = await this.prisma.transaction.count({
      where: {
        workspaceId,
        OR: [{ accountId: id }, { transferToAccountId: id }],
      },
    });
    return count > 0;
  }

  /**
   * Check if account name already exists for workspace (case-insensitive)
   */
  async nameExists(
    workspaceId: string,
    name: string,
    excludeId?: string,
  ): Promise<boolean> {
    const where: Prisma.AccountWhereInput = {
      workspaceId,
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
  async getBalanceSummary(workspaceId: string): Promise<
    {
      currencyCode: string;
      _sum: { balance: Prisma.Decimal | null };
      _count: number;
    }[]
  > {
    const result = await this.prisma.account.groupBy({
      by: ['currencyCode'],
      where: { workspaceId, isArchived: false, includeInTotal: true },
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
