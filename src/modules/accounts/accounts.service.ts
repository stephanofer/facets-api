import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@common/constants/app.constants';
import { BusinessException } from '@common/exceptions/business.exception';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import {
  AccountsRepository,
  AccountRecord,
} from '@modules/accounts/accounts.repository';
import { AccountResponseDto } from '@modules/accounts/dtos/account-response.dto';
import { CreateAccountDto } from '@modules/accounts/dtos/create-account.dto';
import { ListAccountsQueryDto } from '@modules/accounts/dtos/list-accounts-query.dto';
import { UpdateAccountDto } from '@modules/accounts/dtos/update-account.dto';
import { AccountProfilePayloadValidator } from '@modules/accounts/domain/account-profile-payload.validator';
import { getAccountTypeDefinition } from '@modules/accounts/domain/account-type-definitions';
import { AccountStatus } from '@/generated/prisma/client';

const IMMUTABLE_ACCOUNT_FIELDS = [
  'workspaceId',
  'type',
  'currencyCode',
  'initialBalance',
  'currentBalanceCached',
] as const;

@Injectable()
export class AccountsService {
  constructor(
    private readonly accountsRepository: AccountsRepository,
    private readonly profilePayloadValidator: AccountProfilePayloadValidator,
  ) {}

  async list(
    principal: AuthenticatedPrincipal,
    query: ListAccountsQueryDto,
  ): Promise<AccountResponseDto[]> {
    const status = query.status ?? AccountStatus.ACTIVE;
    const accounts = await this.accountsRepository.findManyByWorkspace(
      principal.workspaceId,
      status,
    );

    return accounts.map((account) => this.toResponse(account));
  }

  async getById(
    principal: AuthenticatedPrincipal,
    accountId: string,
  ): Promise<AccountResponseDto> {
    const account = await this.findAccountOrThrow(
      principal.workspaceId,
      accountId,
    );
    return this.toResponse(account);
  }

  async create(
    principal: AuthenticatedPrincipal,
    dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    await this.ensureSupportedCurrency(dto.currencyCode);
    const profile = this.profilePayloadValidator.validateForCreate(
      dto.type,
      dto.profile,
    );

    const account = await this.accountsRepository.create(
      principal.workspaceId,
      {
        name: dto.name,
        type: dto.type,
        currencyCode: dto.currencyCode,
        initialBalance: dto.initialBalance,
        includeInReports: dto.includeInReports,
        notes: dto.notes,
      },
      profile,
    );

    return this.toResponse(account);
  }

  async update(
    principal: AuthenticatedPrincipal,
    accountId: string,
    dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    this.ensureImmutableFieldsNotChanged(dto);

    const existing = await this.findAccountOrThrow(
      principal.workspaceId,
      accountId,
    );
    const profile =
      dto.profile !== undefined
        ? this.profilePayloadValidator.validateForUpdate(
            existing.type,
            dto.profile,
          )
        : undefined;

    const updated = await this.accountsRepository.update(
      principal.workspaceId,
      accountId,
      {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.includeInReports !== undefined && {
          includeInReports: dto.includeInReports,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      profile,
    );

    return this.toResponse(updated);
  }

  async archive(
    principal: AuthenticatedPrincipal,
    accountId: string,
  ): Promise<AccountResponseDto> {
    const account = await this.findAccountOrThrow(
      principal.workspaceId,
      accountId,
    );

    if (account.status === AccountStatus.ARCHIVED) {
      throw new BusinessException(
        ERROR_CODES.ACCOUNT_ALREADY_ARCHIVED,
        'Account is already archived',
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.accountsRepository.updateStatus(
      principal.workspaceId,
      accountId,
      AccountStatus.ARCHIVED,
    );

    return this.toResponse(updated);
  }

  async reactivate(
    principal: AuthenticatedPrincipal,
    accountId: string,
  ): Promise<AccountResponseDto> {
    const account = await this.findAccountOrThrow(
      principal.workspaceId,
      accountId,
    );

    if (account.status === AccountStatus.ACTIVE) {
      throw new BusinessException(
        ERROR_CODES.ACCOUNT_ALREADY_ACTIVE,
        'Account is already active',
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.accountsRepository.updateStatus(
      principal.workspaceId,
      accountId,
      AccountStatus.ACTIVE,
    );

    return this.toResponse(updated);
  }

  private async ensureSupportedCurrency(currencyCode: string): Promise<void> {
    const currency =
      await this.accountsRepository.findSupportedCurrency(currencyCode);

    if (!currency) {
      throw new BusinessException(
        ERROR_CODES.ACCOUNT_CURRENCY_UNSUPPORTED,
        `Currency ${currencyCode} is not supported`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private ensureImmutableFieldsNotChanged(dto: UpdateAccountDto): void {
    const attemptedField = IMMUTABLE_ACCOUNT_FIELDS.find(
      (field) => dto[field] !== undefined,
    );

    if (!attemptedField) {
      return;
    }

    throw new BusinessException(
      ERROR_CODES.ACCOUNT_FIELD_IMMUTABLE,
      `${attemptedField} cannot be changed after account creation`,
      HttpStatus.CONFLICT,
      [{ field: attemptedField, message: `${attemptedField} is immutable` }],
    );
  }

  private async findAccountOrThrow(
    workspaceId: string,
    accountId: string,
  ): Promise<AccountRecord> {
    const account = await this.accountsRepository.findById(
      workspaceId,
      accountId,
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

  private toResponse(account: AccountRecord): AccountResponseDto {
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      currencyCode: account.currencyCode,
      status: account.status,
      includeInReports: account.includeInReports,
      notes: account.notes,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      profile: getAccountTypeDefinition(account.type).mapProfile(account),
    };
  }
}
