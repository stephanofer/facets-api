import { Injectable, HttpStatus } from '@nestjs/common';
import { AccountsRepository } from '@modules/accounts/accounts.repository';
import { SubscriptionsService } from '@modules/subscriptions/subscriptions.service';
import { CreateAccountDto } from '@modules/accounts/dtos/create-account.dto';
import { UpdateAccountDto } from '@modules/accounts/dtos/update-account.dto';
import { QueryAccountDto } from '@modules/accounts/dtos/query-account.dto';
import {
  AccountResponseDto,
  AccountListResponseDto,
  AccountSummaryResponseDto,
} from '@modules/accounts/dtos/account-response.dto';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_CODES } from '@common/constants/app.constants';
import { FEATURES } from '@modules/subscriptions/constants/features.constant';
import { Account, AccountType } from '../../generated/prisma/client';

@Injectable()
export class AccountsService {
  constructor(
    private readonly accountsRepository: AccountsRepository,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Create a new financial account
   *
   * Checks:
   * 1. Feature limit (accounts count per plan)
   * 2. Currency exists
   * 3. Duplicate name
   * 4. Credit card field validation
   */
  async create(
    userId: string,
    dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    // Check feature limit
    const currentCount = await this.accountsRepository.countActive(userId);
    const access = await this.subscriptionsService.checkFeatureAccess(
      userId,
      FEATURES.ACCOUNTS,
      currentCount,
    );

    if (!access.allowed) {
      throw new BusinessException(
        ERROR_CODES.FEATURE_LIMIT_EXCEEDED,
        `You have reached your account limit (${access.current}/${access.limit}). Please upgrade your plan.`,
        HttpStatus.FORBIDDEN,
      );
    }

    // Validate currency exists
    if (dto.currencyCode) {
      const currencyValid = await this.accountsRepository.currencyExists(
        dto.currencyCode,
      );
      if (!currencyValid) {
        throw new BusinessException(
          ERROR_CODES.VALIDATION_ERROR,
          `Currency '${dto.currencyCode}' is not supported`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Check duplicate name
    const nameExists = await this.accountsRepository.nameExists(
      userId,
      dto.name,
    );
    if (nameExists) {
      throw new BusinessException(
        ERROR_CODES.ACCOUNT_DUPLICATE_NAME,
        `An account with the name '${dto.name}' already exists`,
        HttpStatus.CONFLICT,
      );
    }

    // Validate credit card fields
    this.validateCreditCardFields(dto.type, dto);

    const account = await this.accountsRepository.create({
      userId,
      name: dto.name,
      type: dto.type,
      balance: dto.balance ?? 0,
      currencyCode: dto.currencyCode ?? 'USD',
      color: dto.color,
      icon: dto.icon,
      includeInTotal: dto.includeInTotal ?? true,
      creditLimit:
        dto.type === AccountType.CREDIT_CARD ? dto.creditLimit : null,
      statementClosingDay:
        dto.type === AccountType.CREDIT_CARD ? dto.statementClosingDay : null,
      paymentDueDay:
        dto.type === AccountType.CREDIT_CARD ? dto.paymentDueDay : null,
      sortOrder: dto.sortOrder ?? 0,
    });

    return this.toResponseDto(account);
  }

  /**
   * Get all accounts for a user with optional filters
   */
  async findAll(
    userId: string,
    query: QueryAccountDto,
  ): Promise<AccountListResponseDto> {
    const accounts = await this.accountsRepository.findAll({
      userId,
      type: query.type,
      includeArchived: query.includeArchived ?? false,
      currencyCode: query.currencyCode,
    });

    return {
      accounts: accounts.map((a) => this.toResponseDto(a)),
      total: accounts.length,
    };
  }

  /**
   * Get a single account by ID
   */
  async findById(
    userId: string,
    accountId: string,
  ): Promise<AccountResponseDto> {
    const account = await this.findAccountOrThrow(accountId, userId);
    return this.toResponseDto(account);
  }

  /**
   * Update an account
   */
  async update(
    userId: string,
    accountId: string,
    dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    const account = await this.findAccountOrThrow(accountId, userId);

    // Check duplicate name (if name is being changed)
    if (dto.name && dto.name !== account.name) {
      const nameExists = await this.accountsRepository.nameExists(
        userId,
        dto.name,
        accountId,
      );
      if (nameExists) {
        throw new BusinessException(
          ERROR_CODES.ACCOUNT_DUPLICATE_NAME,
          `An account with the name '${dto.name}' already exists`,
          HttpStatus.CONFLICT,
        );
      }
    }

    // Validate credit card fields if account is a credit card
    if (account.type === AccountType.CREDIT_CARD) {
      // Allow updating credit card fields
    } else {
      // Strip credit card fields for non-credit card accounts
      dto.creditLimit = undefined;
      dto.statementClosingDay = undefined;
      dto.paymentDueDay = undefined;
    }

    const updated = await this.accountsRepository.update(accountId, userId, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.balance !== undefined && { balance: dto.balance }),
      ...(dto.color !== undefined && { color: dto.color }),
      ...(dto.icon !== undefined && { icon: dto.icon }),
      ...(dto.includeInTotal !== undefined && {
        includeInTotal: dto.includeInTotal,
      }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.creditLimit !== undefined && { creditLimit: dto.creditLimit }),
      ...(dto.statementClosingDay !== undefined && {
        statementClosingDay: dto.statementClosingDay,
      }),
      ...(dto.paymentDueDay !== undefined && {
        paymentDueDay: dto.paymentDueDay,
      }),
    });

    return this.toResponseDto(updated);
  }

  /**
   * Delete an account
   *
   * Only allowed if the account has NO transactions.
   * If it has transactions, the user should archive it instead.
   */
  async delete(userId: string, accountId: string): Promise<void> {
    await this.findAccountOrThrow(accountId, userId);

    const hasTransactions =
      await this.accountsRepository.hasTransactions(accountId);
    if (hasTransactions) {
      throw new BusinessException(
        ERROR_CODES.ACCOUNT_HAS_TRANSACTIONS,
        'Cannot delete an account with transactions. Archive it instead.',
        HttpStatus.CONFLICT,
      );
    }

    await this.accountsRepository.delete(accountId);
  }

  /**
   * Archive an account (soft delete — hide from UI, keep transactions)
   */
  async archive(
    userId: string,
    accountId: string,
  ): Promise<AccountResponseDto> {
    await this.findAccountOrThrow(accountId, userId);

    const updated = await this.accountsRepository.setArchived(
      accountId,
      userId,
      true,
    );
    return this.toResponseDto(updated);
  }

  /**
   * Unarchive an account (restore visibility)
   *
   * Checks feature limit before restoring since archived accounts
   * don't count towards the limit.
   */
  async unarchive(
    userId: string,
    accountId: string,
  ): Promise<AccountResponseDto> {
    const account = await this.findAccountOrThrow(accountId, userId);

    if (!account.isArchived) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION_ERROR,
        'Account is not archived',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check feature limit before restoring
    const currentCount = await this.accountsRepository.countActive(userId);
    const access = await this.subscriptionsService.checkFeatureAccess(
      userId,
      FEATURES.ACCOUNTS,
      currentCount,
    );

    if (!access.allowed) {
      throw new BusinessException(
        ERROR_CODES.FEATURE_LIMIT_EXCEEDED,
        `Cannot unarchive: you have reached your account limit (${access.current}/${access.limit}). Please upgrade your plan.`,
        HttpStatus.FORBIDDEN,
      );
    }

    const updated = await this.accountsRepository.setArchived(
      accountId,
      userId,
      false,
    );
    return this.toResponseDto(updated);
  }

  /**
   * Get balance summary grouped by currency
   */
  async getBalanceSummary(userId: string): Promise<AccountSummaryResponseDto> {
    const summary = await this.accountsRepository.getBalanceSummary(userId);
    const activeCount = await this.accountsRepository.countActive(userId);

    return {
      balances: summary.map((s) => ({
        currencyCode: s.currencyCode,
        totalBalance: s._sum.balance?.toString() ?? '0',
        accountCount: s._count,
      })),
      totalAccounts: activeCount,
    };
  }

  /**
   * Count active accounts for a user (used by FeatureGuard/SubscriptionsService)
   */
  async countActive(userId: string): Promise<number> {
    return this.accountsRepository.countActive(userId);
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Find account or throw 404
   */
  private async findAccountOrThrow(
    accountId: string,
    userId: string,
  ): Promise<Account> {
    const account = await this.accountsRepository.findById(accountId, userId);

    if (!account) {
      throw new BusinessException(
        ERROR_CODES.ACCOUNT_NOT_FOUND,
        'Account not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return account;
  }

  /**
   * Validate credit card specific fields
   */
  private validateCreditCardFields(
    type: AccountType,
    dto: CreateAccountDto,
  ): void {
    if (type === AccountType.CREDIT_CARD) {
      // Credit card should have a credit limit
      if (dto.creditLimit === undefined || dto.creditLimit === null) {
        throw new BusinessException(
          ERROR_CODES.INVALID_CREDIT_CARD_FIELDS,
          'Credit limit is required for credit card accounts',
          HttpStatus.BAD_REQUEST,
        );
      }
    } else {
      // Non-credit card accounts should NOT have credit card fields
      if (
        dto.creditLimit !== undefined ||
        dto.statementClosingDay !== undefined ||
        dto.paymentDueDay !== undefined
      ) {
        throw new BusinessException(
          ERROR_CODES.INVALID_CREDIT_CARD_FIELDS,
          'Credit card fields (creditLimit, statementClosingDay, paymentDueDay) are only valid for CREDIT_CARD type accounts',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  /**
   * Map Account entity to response DTO
   */
  private toResponseDto(account: Account): AccountResponseDto {
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      balance: account.balance.toString(),
      currencyCode: account.currencyCode,
      color: account.color ?? undefined,
      icon: account.icon ?? undefined,
      includeInTotal: account.includeInTotal,
      isArchived: account.isArchived,
      creditLimit: account.creditLimit?.toString() ?? undefined,
      statementClosingDay: account.statementClosingDay ?? undefined,
      paymentDueDay: account.paymentDueDay ?? undefined,
      sortOrder: account.sortOrder,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}
