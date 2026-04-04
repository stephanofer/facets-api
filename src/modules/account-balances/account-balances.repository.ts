import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import {
  Prisma,
  TransactionDirection,
  TransactionStatus,
} from '@/generated/prisma/client';
import { normalizeBalanceDate } from '@modules/account-balances/domain/account-balance-date.utils';

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

const reconciliationInclude = {
  createdByUser: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.AccountReconciliationInclude;

const accountSelect = {
  id: true,
  workspaceId: true,
  currencyCode: true,
  initialBalance: true,
  currentBalanceCached: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AccountSelect;

const dailyBalanceSelect = {
  id: true,
  accountId: true,
  date: true,
  currencyCode: true,
  openingBalance: true,
  inflowsAmount: true,
  outflowsAmount: true,
  adjustmentsAmount: true,
  closingBalance: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AccountDailyBalanceSelect;

export type AccountBalanceAccountRecord = Prisma.AccountGetPayload<{
  select: typeof accountSelect;
}>;

export type AccountReconciliationRecord =
  Prisma.AccountReconciliationGetPayload<{
    include: typeof reconciliationInclude;
  }>;

export type DailyBalanceRecord = Prisma.AccountDailyBalanceGetPayload<{
  select: typeof dailyBalanceSelect;
}>;

export interface DailyTransactionAggregateRecord {
  date: Date;
  direction: TransactionDirection;
  amount: Prisma.Decimal;
}

export interface CreateReconciliationInput {
  accountId: string;
  createdByUserId?: string;
  date: Date;
  targetBalance: number;
  reason?: string | null;
}

export interface UpdateReconciliationInput {
  date?: Date;
  targetBalance?: number;
  reason?: string | null;
}

export interface CreateDailyBalanceInput {
  accountId: string;
  date: Date;
  currencyCode: string;
  openingBalance: Prisma.Decimal;
  inflowsAmount: Prisma.Decimal;
  outflowsAmount: Prisma.Decimal;
  adjustmentsAmount: Prisma.Decimal;
  closingBalance: Prisma.Decimal;
}

@Injectable()
export class AccountBalancesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAccountById(
    workspaceId: string,
    accountId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountBalanceAccountRecord | null> {
    return this.getClient(tx).account.findFirst({
      where: {
        id: accountId,
        workspaceId,
      },
      select: accountSelect,
    });
  }

  async findReconciliations(
    workspaceId: string,
    accountId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountReconciliationRecord[]> {
    return this.getClient(tx).accountReconciliation.findMany({
      where: {
        accountId,
        account: {
          is: {
            id: accountId,
            workspaceId,
          },
        },
      },
      include: reconciliationInclude,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async findReconciliationById(
    workspaceId: string,
    accountId: string,
    reconciliationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountReconciliationRecord | null> {
    return this.getClient(tx).accountReconciliation.findFirst({
      where: {
        id: reconciliationId,
        accountId,
        account: {
          is: {
            id: accountId,
            workspaceId,
          },
        },
      },
      include: reconciliationInclude,
    });
  }

  async findReconciliationsByDate(
    workspaceId: string,
    accountId: string,
    date: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountReconciliationRecord[]> {
    return this.getClient(tx).accountReconciliation.findMany({
      where: {
        accountId,
        date: normalizeBalanceDate(date),
        account: {
          is: {
            id: accountId,
            workspaceId,
          },
        },
      },
      include: reconciliationInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async createReconciliation(
    data: CreateReconciliationInput,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountReconciliationRecord> {
    return this.getClient(tx).accountReconciliation.create({
      data: {
        accountId: data.accountId,
        createdByUserId: data.createdByUserId,
        date: normalizeBalanceDate(data.date),
        targetBalance: data.targetBalance,
        reason: data.reason ?? null,
      },
      include: reconciliationInclude,
    });
  }

  async updateReconciliation(
    reconciliationId: string,
    data: UpdateReconciliationInput,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountReconciliationRecord> {
    return this.getClient(tx).accountReconciliation.update({
      where: { id: reconciliationId },
      data: {
        ...(data.date && { date: normalizeBalanceDate(data.date) }),
        ...(data.targetBalance !== undefined && {
          targetBalance: data.targetBalance,
        }),
        ...(data.reason !== undefined && { reason: data.reason }),
      },
      include: reconciliationInclude,
    });
  }

  async deleteReconciliation(
    reconciliationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.getClient(tx).accountReconciliation.delete({
      where: { id: reconciliationId },
    });
  }

  async findPreviousDailyBalance(
    workspaceId: string,
    accountId: string,
    beforeDate: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<DailyBalanceRecord | null> {
    return this.getClient(tx).accountDailyBalance.findFirst({
      where: {
        accountId,
        date: { lt: normalizeBalanceDate(beforeDate) },
        account: {
          is: {
            id: accountId,
            workspaceId,
          },
        },
      },
      select: dailyBalanceSelect,
      orderBy: [{ date: 'desc' }],
    });
  }

  async findLatestDailyBalance(
    workspaceId: string,
    accountId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<DailyBalanceRecord | null> {
    return this.getClient(tx).accountDailyBalance.findFirst({
      where: {
        accountId,
        account: {
          is: {
            id: accountId,
            workspaceId,
          },
        },
      },
      select: dailyBalanceSelect,
      orderBy: [{ date: 'desc' }],
    });
  }

  async findLatestDailyBalanceFromDate(
    workspaceId: string,
    accountId: string,
    fromDate: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<DailyBalanceRecord | null> {
    return this.getClient(tx).accountDailyBalance.findFirst({
      where: {
        accountId,
        date: { gte: normalizeBalanceDate(fromDate) },
        account: {
          is: {
            id: accountId,
            workspaceId,
          },
        },
      },
      select: dailyBalanceSelect,
      orderBy: [{ date: 'desc' }],
    });
  }

  async findDailyBalancesInRange(
    workspaceId: string,
    accountId: string,
    fromDate?: Date,
    toDate?: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<DailyBalanceRecord[]> {
    return this.getClient(tx).accountDailyBalance.findMany({
      where: {
        accountId,
        ...(fromDate || toDate
          ? {
              date: {
                ...(fromDate && { gte: normalizeBalanceDate(fromDate) }),
                ...(toDate && { lte: normalizeBalanceDate(toDate) }),
              },
            }
          : {}),
        account: {
          is: {
            id: accountId,
            workspaceId,
          },
        },
      },
      select: dailyBalanceSelect,
      orderBy: [{ date: 'asc' }],
    });
  }

  async findLatestActiveTransactionDateFrom(
    workspaceId: string,
    accountId: string,
    fromDate: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<Date | null> {
    const transaction = await this.getClient(tx).transaction.findFirst({
      where: {
        accountId,
        status: TransactionStatus.ACTIVE,
        date: { gte: normalizeBalanceDate(fromDate) },
        account: {
          is: {
            id: accountId,
            workspaceId,
          },
        },
      },
      select: { date: true },
      orderBy: [{ date: 'desc' }],
    });

    return transaction?.date ?? null;
  }

  async findEarliestActiveTransactionDateUntil(
    workspaceId: string,
    accountId: string,
    throughDate: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<Date | null> {
    const transaction = await this.getClient(tx).transaction.findFirst({
      where: {
        accountId,
        status: TransactionStatus.ACTIVE,
        date: { lte: normalizeBalanceDate(throughDate) },
        account: {
          is: {
            id: accountId,
            workspaceId,
          },
        },
      },
      select: { date: true },
      orderBy: [{ date: 'asc' }],
    });

    return transaction?.date ?? null;
  }

  async findLatestReconciliationDateFrom(
    workspaceId: string,
    accountId: string,
    fromDate: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<Date | null> {
    const reconciliation = await this.getClient(
      tx,
    ).accountReconciliation.findFirst({
      where: {
        accountId,
        date: { gte: normalizeBalanceDate(fromDate) },
        account: {
          is: {
            id: accountId,
            workspaceId,
          },
        },
      },
      select: { date: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });

    return reconciliation?.date ?? null;
  }

  async findEarliestReconciliationDateUntil(
    workspaceId: string,
    accountId: string,
    throughDate: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<Date | null> {
    const reconciliation = await this.getClient(
      tx,
    ).accountReconciliation.findFirst({
      where: {
        accountId,
        date: { lte: normalizeBalanceDate(throughDate) },
        account: {
          is: {
            id: accountId,
            workspaceId,
          },
        },
      },
      select: { date: true },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });

    return reconciliation?.date ?? null;
  }

  async findTransactionDailyAggregates(
    workspaceId: string,
    accountId: string,
    fromDate: Date,
    throughDate: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<DailyTransactionAggregateRecord[]> {
    const rows = await this.getClient(tx).transaction.groupBy({
      by: ['date', 'direction'],
      where: {
        accountId,
        status: TransactionStatus.ACTIVE,
        date: {
          gte: normalizeBalanceDate(fromDate),
          lte: normalizeBalanceDate(throughDate),
        },
        account: {
          is: {
            id: accountId,
            workspaceId,
          },
        },
      },
      _sum: {
        amount: true,
      },
      orderBy: [{ date: 'asc' }],
    });

    return rows.map((row) => ({
      date: row.date,
      direction: row.direction,
      amount: row._sum.amount ?? new Prisma.Decimal(0),
    }));
  }

  async findReconciliationsInRange(
    workspaceId: string,
    accountId: string,
    fromDate: Date,
    throughDate: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<
    Array<
      Pick<
        AccountReconciliationRecord,
        'id' | 'date' | 'targetBalance' | 'createdAt'
      >
    >
  > {
    return this.getClient(tx).accountReconciliation.findMany({
      where: {
        accountId,
        date: {
          gte: normalizeBalanceDate(fromDate),
          lte: normalizeBalanceDate(throughDate),
        },
        account: {
          is: {
            id: accountId,
            workspaceId,
          },
        },
      },
      select: {
        id: true,
        date: true,
        targetBalance: true,
        createdAt: true,
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async deleteDailyBalancesFromDate(
    workspaceId: string,
    accountId: string,
    fromDate: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.getClient(tx).accountDailyBalance.deleteMany({
      where: {
        accountId,
        date: { gte: normalizeBalanceDate(fromDate) },
        account: {
          is: {
            id: accountId,
            workspaceId,
          },
        },
      },
    });
  }

  async createDailyBalances(
    rows: CreateDailyBalanceInput[],
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await this.getClient(tx).accountDailyBalance.createMany({
      data: rows.map((row) => ({
        accountId: row.accountId,
        date: normalizeBalanceDate(row.date),
        currencyCode: row.currencyCode,
        openingBalance: row.openingBalance,
        inflowsAmount: row.inflowsAmount,
        outflowsAmount: row.outflowsAmount,
        adjustmentsAmount: row.adjustmentsAmount,
        closingBalance: row.closingBalance,
      })),
    });
  }

  async updateAccountCurrentBalance(
    workspaceId: string,
    accountId: string,
    balance: Prisma.Decimal,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.getClient(tx).account.update({
      where: {
        id: accountId,
        workspaceId,
      },
      data: {
        currentBalanceCached: balance,
      },
    });
  }

  async touchWorkspaceFinancialData(
    workspaceId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.getClient(tx).workspace.update({
      where: { id: workspaceId },
      data: {
        financialDataUpdatedAt: new Date(),
      },
    });
  }

  private getClient(tx?: Prisma.TransactionClient): PrismaClientLike {
    return tx ?? this.prisma;
  }
}
