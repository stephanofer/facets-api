import { Injectable } from '@nestjs/common';
import { Prisma, TransactionDirection } from '@/generated/prisma/client';
import { AccountBalancesRepository } from '@modules/account-balances/account-balances.repository';
import type { CreateDailyBalanceInput } from '@modules/account-balances/account-balances.repository';
import {
  addBalanceDays,
  formatBalanceDate,
  minBalanceDate,
  maxBalanceDate,
  normalizeBalanceDate,
} from '@modules/account-balances/domain/account-balance-date.utils';

interface RecomputeResult {
  snapshotCount: number;
  throughDate: Date | null;
  currentBalance: Prisma.Decimal;
}

@Injectable()
export class AccountBalanceRecomputeService {
  constructor(
    private readonly accountBalancesRepository: AccountBalancesRepository,
  ) {}

  async recomputeFromDate(
    accountId: string,
    workspaceId: string,
    affectedDate: Date,
    tx: Prisma.TransactionClient,
  ): Promise<RecomputeResult> {
    const normalizedAffectedDate = normalizeBalanceDate(affectedDate);
    const account = await this.accountBalancesRepository.findAccountById(
      workspaceId,
      accountId,
      tx,
    );

    if (!account) {
      throw new Error('Account must exist before recompute');
    }

    const previousSnapshot =
      await this.accountBalancesRepository.findPreviousDailyBalance(
        workspaceId,
        accountId,
        normalizedAffectedDate,
        tx,
      );
    const latestSnapshotFromDate =
      await this.accountBalancesRepository.findLatestDailyBalanceFromDate(
        workspaceId,
        accountId,
        normalizedAffectedDate,
        tx,
      );
    const latestTransactionDate =
      await this.accountBalancesRepository.findLatestActiveTransactionDateFrom(
        workspaceId,
        accountId,
        normalizedAffectedDate,
        tx,
      );
    const latestReconciliationDate =
      await this.accountBalancesRepository.findLatestReconciliationDateFrom(
        workspaceId,
        accountId,
        normalizedAffectedDate,
        tx,
      );

    const throughDate = maxBalanceDate([
      latestTransactionDate,
      latestReconciliationDate,
      latestSnapshotFromDate?.date,
    ]);

    const earliestTransactionDate = throughDate
      ? await this.accountBalancesRepository.findEarliestActiveTransactionDateUntil(
          workspaceId,
          accountId,
          throughDate,
          tx,
        )
      : null;
    const earliestReconciliationDate = throughDate
      ? await this.accountBalancesRepository.findEarliestReconciliationDateUntil(
          workspaceId,
          accountId,
          throughDate,
          tx,
        )
      : null;
    const earliestSourceDate = earliestTransactionDate
      ? earliestReconciliationDate
        ? minBalanceDate(earliestTransactionDate, earliestReconciliationDate)
        : earliestTransactionDate
      : earliestReconciliationDate;
    const recomputeStartDate = previousSnapshot
      ? normalizedAffectedDate
      : earliestSourceDate
        ? minBalanceDate(normalizedAffectedDate, earliestSourceDate)
        : normalizedAffectedDate;

    await this.accountBalancesRepository.deleteDailyBalancesFromDate(
      workspaceId,
      accountId,
      recomputeStartDate,
      tx,
    );

    const previousClosingBalance = previousSnapshot?.closingBalance
      ? new Prisma.Decimal(previousSnapshot.closingBalance)
      : new Prisma.Decimal(account.initialBalance);

    if (!throughDate) {
      await this.accountBalancesRepository.updateAccountCurrentBalance(
        workspaceId,
        accountId,
        previousClosingBalance,
        tx,
      );
      await this.accountBalancesRepository.touchWorkspaceFinancialData(
        workspaceId,
        tx,
      );

      return {
        snapshotCount: 0,
        throughDate: null,
        currentBalance: previousClosingBalance,
      };
    }

    const [transactionAggregates, reconciliations] = await Promise.all([
      this.accountBalancesRepository.findTransactionDailyAggregates(
        workspaceId,
        accountId,
        recomputeStartDate,
        throughDate,
        tx,
      ),
      this.accountBalancesRepository.findReconciliationsInRange(
        workspaceId,
        accountId,
        recomputeStartDate,
        throughDate,
        tx,
      ),
    ]);

    const zero = new Prisma.Decimal(0);
    const flowsByDate = new Map<
      string,
      { inflowsAmount: Prisma.Decimal; outflowsAmount: Prisma.Decimal }
    >();

    for (const aggregate of transactionAggregates) {
      const key = formatBalanceDate(aggregate.date);
      const entry = flowsByDate.get(key) ?? {
        inflowsAmount: zero,
        outflowsAmount: zero,
      };

      if (aggregate.direction === TransactionDirection.INFLOW) {
        entry.inflowsAmount = entry.inflowsAmount.plus(aggregate.amount);
      } else {
        entry.outflowsAmount = entry.outflowsAmount.plus(aggregate.amount);
      }

      flowsByDate.set(key, entry);
    }

    const effectiveReconciliationByDate = new Map<string, Prisma.Decimal>();

    for (const reconciliation of reconciliations) {
      const key = formatBalanceDate(reconciliation.date);

      if (!effectiveReconciliationByDate.has(key)) {
        effectiveReconciliationByDate.set(
          key,
          new Prisma.Decimal(reconciliation.targetBalance),
        );
      }
    }

    const rows: CreateDailyBalanceInput[] = [];
    let openingBalance = previousClosingBalance;

    for (
      let cursor = recomputeStartDate;
      cursor.getTime() <= throughDate.getTime();
      cursor = addBalanceDays(cursor, 1)
    ) {
      const key = formatBalanceDate(cursor);
      const flow = flowsByDate.get(key);
      const inflowsAmount = flow?.inflowsAmount ?? zero;
      const outflowsAmount = flow?.outflowsAmount ?? zero;
      const calculatedBalance = openingBalance
        .plus(inflowsAmount)
        .minus(outflowsAmount);
      const targetBalance = effectiveReconciliationByDate.get(key);
      const adjustmentsAmount = targetBalance
        ? targetBalance.minus(calculatedBalance)
        : zero;
      const closingBalance = calculatedBalance.plus(adjustmentsAmount);

      rows.push({
        accountId,
        date: cursor,
        currencyCode: account.currencyCode,
        openingBalance,
        inflowsAmount,
        outflowsAmount,
        adjustmentsAmount,
        closingBalance,
      });

      openingBalance = closingBalance;
    }

    await this.accountBalancesRepository.createDailyBalances(rows, tx);

    const currentBalance =
      rows.length > 0
        ? rows[rows.length - 1].closingBalance
        : previousClosingBalance;

    await this.accountBalancesRepository.updateAccountCurrentBalance(
      workspaceId,
      accountId,
      currentBalance,
      tx,
    );
    await this.accountBalancesRepository.touchWorkspaceFinancialData(
      workspaceId,
      tx,
    );

    return {
      snapshotCount: rows.length,
      throughDate,
      currentBalance,
    };
  }
}
