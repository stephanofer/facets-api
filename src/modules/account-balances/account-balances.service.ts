import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@common/constants/app.constants';
import { BusinessException } from '@common/exceptions/business.exception';
import { PrismaService } from '@database/prisma.service';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import {
  AccountBalancesRepository,
  AccountBalanceAccountRecord,
  AccountReconciliationRecord,
  DailyBalanceRecord,
} from '@modules/account-balances/account-balances.repository';
import { BalanceSummaryResponseDto } from '@modules/account-balances/dtos/balance-summary-response.dto';
import { CreateAccountReconciliationDto } from '@modules/account-balances/dtos/create-account-reconciliation.dto';
import { DailyBalanceTimelineItemDto } from '@modules/account-balances/dtos/daily-balance-timeline-item.dto';
import { ListDailyBalancesQueryDto } from '@modules/account-balances/dtos/list-daily-balances-query.dto';
import { AccountReconciliationAuthorDto } from '@modules/account-balances/dtos/account-reconciliation-author.dto';
import { AccountReconciliationResponseDto } from '@modules/account-balances/dtos/account-reconciliation-response.dto';
import { UpdateAccountReconciliationDto } from '@modules/account-balances/dtos/update-account-reconciliation.dto';
import { AccountBalanceRecomputeService } from '@modules/account-balances/domain/account-balance-recompute.service';
import {
  formatBalanceDate,
  minBalanceDate,
  normalizeBalanceDate,
} from '@modules/account-balances/domain/account-balance-date.utils';
import { Prisma } from '@/generated/prisma/client';

const TRANSACTION_RETRY_LIMIT = 2;

@Injectable()
export class AccountBalancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountBalancesRepository: AccountBalancesRepository,
    private readonly recomputeService: AccountBalanceRecomputeService,
  ) {}

  async createReconciliation(
    principal: AuthenticatedPrincipal,
    accountId: string,
    dto: CreateAccountReconciliationDto,
  ): Promise<AccountReconciliationResponseDto> {
    return this.runWithRetry(async () =>
      this.prisma.$transaction(async (tx) => {
        await this.findAccountOrThrow(principal.workspaceId, accountId, tx);

        const normalizedDate = normalizeBalanceDate(dto.date);
        const reconciliation =
          await this.accountBalancesRepository.createReconciliation(
            {
              accountId,
              createdByUserId: principal.actorUserId,
              date: normalizedDate,
              targetBalance: dto.targetBalance,
              reason: dto.reason ?? null,
            },
            tx,
          );

        await this.recomputeService.recomputeFromDate(
          accountId,
          principal.workspaceId,
          normalizedDate,
          tx,
        );

        const sameDayReconciliations =
          await this.accountBalancesRepository.findReconciliationsByDate(
            principal.workspaceId,
            accountId,
            normalizedDate,
            tx,
          );

        return this.toReconciliationResponse(
          reconciliation,
          sameDayReconciliations[0]?.id === reconciliation.id,
        );
      }),
    );
  }

  async listReconciliations(
    principal: AuthenticatedPrincipal,
    accountId: string,
  ): Promise<AccountReconciliationResponseDto[]> {
    await this.findAccountOrThrow(principal.workspaceId, accountId);

    const reconciliations =
      await this.accountBalancesRepository.findReconciliations(
        principal.workspaceId,
        accountId,
      );
    const effectiveDates = new Set<string>();

    return reconciliations.map((reconciliation) => {
      const key = formatBalanceDate(reconciliation.date);
      const isEffective = !effectiveDates.has(key);

      if (isEffective) {
        effectiveDates.add(key);
      }

      return this.toReconciliationResponse(reconciliation, isEffective);
    });
  }

  async getReconciliationById(
    principal: AuthenticatedPrincipal,
    accountId: string,
    reconciliationId: string,
  ): Promise<AccountReconciliationResponseDto> {
    const reconciliation = await this.findReconciliationOrThrow(
      principal.workspaceId,
      accountId,
      reconciliationId,
    );
    const sameDayReconciliations =
      await this.accountBalancesRepository.findReconciliationsByDate(
        principal.workspaceId,
        accountId,
        reconciliation.date,
      );

    return this.toReconciliationResponse(
      reconciliation,
      sameDayReconciliations[0]?.id === reconciliation.id,
    );
  }

  async updateReconciliation(
    principal: AuthenticatedPrincipal,
    accountId: string,
    reconciliationId: string,
    dto: UpdateAccountReconciliationDto,
  ): Promise<AccountReconciliationResponseDto> {
    return this.runWithRetry(async () =>
      this.prisma.$transaction(async (tx) => {
        const existing = await this.findReconciliationOrThrow(
          principal.workspaceId,
          accountId,
          reconciliationId,
          tx,
        );
        const nextDate = dto.date
          ? normalizeBalanceDate(dto.date)
          : existing.date;
        const updated =
          await this.accountBalancesRepository.updateReconciliation(
            reconciliationId,
            {
              ...(dto.date && { date: nextDate }),
              ...(dto.targetBalance !== undefined && {
                targetBalance: dto.targetBalance,
              }),
              ...(dto.reason !== undefined && { reason: dto.reason ?? null }),
            },
            tx,
          );

        await this.recomputeService.recomputeFromDate(
          accountId,
          principal.workspaceId,
          minBalanceDate(existing.date, nextDate),
          tx,
        );

        const sameDayReconciliations =
          await this.accountBalancesRepository.findReconciliationsByDate(
            principal.workspaceId,
            accountId,
            updated.date,
            tx,
          );

        return this.toReconciliationResponse(
          updated,
          sameDayReconciliations[0]?.id === updated.id,
        );
      }),
    );
  }

  async deleteReconciliation(
    principal: AuthenticatedPrincipal,
    accountId: string,
    reconciliationId: string,
  ): Promise<void> {
    await this.runWithRetry(async () =>
      this.prisma.$transaction(async (tx) => {
        const reconciliation = await this.findReconciliationOrThrow(
          principal.workspaceId,
          accountId,
          reconciliationId,
          tx,
        );

        await this.accountBalancesRepository.deleteReconciliation(
          reconciliationId,
          tx,
        );
        await this.recomputeService.recomputeFromDate(
          accountId,
          principal.workspaceId,
          reconciliation.date,
          tx,
        );
      }),
    );
  }

  async getBalanceSummary(
    principal: AuthenticatedPrincipal,
    accountId: string,
  ): Promise<BalanceSummaryResponseDto> {
    const account = await this.findAccountOrThrow(
      principal.workspaceId,
      accountId,
    );
    const latestSnapshot =
      await this.accountBalancesRepository.findLatestDailyBalance(
        principal.workspaceId,
        accountId,
      );

    if (!latestSnapshot) {
      const balance = this.decimalToString(account.currentBalanceCached);

      return {
        accountId: account.id,
        currencyCode: account.currencyCode,
        currentBalance: balance,
        calculatedBalance: balance,
        reconciledBalance: balance,
        difference: '0',
        hasDifference: false,
        lastSnapshotDate: null,
      };
    }

    const calculatedBalance = this.calculateBalance(latestSnapshot);
    const difference = new Prisma.Decimal(latestSnapshot.adjustmentsAmount);

    return {
      accountId: account.id,
      currencyCode: latestSnapshot.currencyCode,
      currentBalance: this.decimalToString(account.currentBalanceCached),
      calculatedBalance: this.decimalToString(calculatedBalance),
      reconciledBalance: this.decimalToString(latestSnapshot.closingBalance),
      difference: this.decimalToString(difference),
      hasDifference: !difference.isZero(),
      lastSnapshotDate: formatBalanceDate(latestSnapshot.date),
    };
  }

  async getDailyBalances(
    principal: AuthenticatedPrincipal,
    accountId: string,
    query: ListDailyBalancesQueryDto,
  ): Promise<DailyBalanceTimelineItemDto[]> {
    await this.findAccountOrThrow(principal.workspaceId, accountId);
    this.ensureDateRange(query.from, query.to);

    const rows = await this.accountBalancesRepository.findDailyBalancesInRange(
      principal.workspaceId,
      accountId,
      query.from,
      query.to,
    );

    return rows.map((row) => this.toDailyBalanceResponse(row));
  }

  private async findAccountOrThrow(
    workspaceId: string,
    accountId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountBalanceAccountRecord> {
    const account = await this.accountBalancesRepository.findAccountById(
      workspaceId,
      accountId,
      tx,
    );

    if (!account) {
      throw new BusinessException(
        ERROR_CODES.ACCOUNT_NOT_FOUND,
        'Account not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return account;
  }

  private async findReconciliationOrThrow(
    workspaceId: string,
    accountId: string,
    reconciliationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountReconciliationRecord> {
    const reconciliation =
      await this.accountBalancesRepository.findReconciliationById(
        workspaceId,
        accountId,
        reconciliationId,
        tx,
      );

    if (!reconciliation) {
      throw new BusinessException(
        ERROR_CODES.ACCOUNT_RECONCILIATION_NOT_FOUND,
        'Account reconciliation not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return reconciliation;
  }

  private toReconciliationResponse(
    reconciliation: AccountReconciliationRecord,
    isEffective: boolean,
  ): AccountReconciliationResponseDto {
    return {
      id: reconciliation.id,
      accountId: reconciliation.accountId,
      date: formatBalanceDate(reconciliation.date),
      targetBalance: this.decimalToString(reconciliation.targetBalance),
      reason: reconciliation.reason,
      isEffective,
      author: this.toAuthorResponse(reconciliation.createdByUser),
      createdAt: reconciliation.createdAt.toISOString(),
      updatedAt: reconciliation.updatedAt.toISOString(),
    };
  }

  private toAuthorResponse(
    author: AccountReconciliationRecord['createdByUser'],
  ): AccountReconciliationAuthorDto | null {
    if (!author) {
      return null;
    }

    return {
      id: author.id,
      email: author.email,
      firstName: author.firstName,
      lastName: author.lastName,
    };
  }

  private toDailyBalanceResponse(
    row: DailyBalanceRecord,
  ): DailyBalanceTimelineItemDto {
    const calculatedBalance = this.calculateBalance(row);

    return {
      date: formatBalanceDate(row.date),
      openingBalance: this.decimalToString(row.openingBalance),
      inflowsAmount: this.decimalToString(row.inflowsAmount),
      outflowsAmount: this.decimalToString(row.outflowsAmount),
      adjustmentsAmount: this.decimalToString(row.adjustmentsAmount),
      closingBalance: this.decimalToString(row.closingBalance),
      calculatedBalance: this.decimalToString(calculatedBalance),
      reconciledBalance: this.decimalToString(row.closingBalance),
      difference: this.decimalToString(row.adjustmentsAmount),
    };
  }

  private calculateBalance(row: DailyBalanceRecord): Prisma.Decimal {
    return new Prisma.Decimal(row.openingBalance)
      .plus(row.inflowsAmount)
      .minus(row.outflowsAmount);
  }

  private decimalToString(value: Prisma.Decimal | string | number): string {
    return new Prisma.Decimal(value).toString();
  }

  private ensureDateRange(from?: Date, to?: Date): void {
    if (!from || !to) {
      return;
    }

    if (
      normalizeBalanceDate(from).getTime() <= normalizeBalanceDate(to).getTime()
    ) {
      return;
    }

    throw new BusinessException(
      ERROR_CODES.VALIDATION_ERROR,
      'from must be before or equal to to',
      HttpStatus.BAD_REQUEST,
      [
        {
          field: 'from',
          message: 'from must be before or equal to to',
        },
      ],
    );
  }

  private async runWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < TRANSACTION_RETRY_LIMIT
        ) {
          attempt += 1;
          continue;
        }

        throw error;
      }
    }
  }
}
