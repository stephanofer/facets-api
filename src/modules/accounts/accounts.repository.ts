import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import {
  Account,
  AccountStatus,
  AccountType,
  Prisma,
} from '@/generated/prisma/client';
import { AccountProfileRelations } from '@modules/accounts/domain/account-type-definition.interface';
import { ValidatedAccountProfilePayload } from '@modules/accounts/domain/account-type-definition.interface';
import { getAccountTypeDefinition } from '@modules/accounts/domain/account-type-definitions';
import { getAccountTypeDefinitionByProfileKind } from '@modules/accounts/domain/account-type-definitions';

const accountInclude = {
  creditCardProfile: true,
  debtProfile: true,
  loanProfile: true,
  lentMoneyProfile: true,
} satisfies Prisma.AccountInclude;

export type AccountRecord = Prisma.AccountGetPayload<{
  include: typeof accountInclude;
}>;

type AccountRecordWithOptionalProfiles = Account &
  Partial<AccountProfileRelations>;

export interface CreateAccountData {
  name: string;
  type: Prisma.AccountCreateInput['type'];
  currencyCode: string;
  initialBalance?: number;
  includeInReports?: boolean;
  notes?: string;
}

export interface UpdateAccountData {
  name?: string;
  includeInReports?: boolean;
  notes?: string;
}

@Injectable()
export class AccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSupportedCurrency(code: string): Promise<{ code: string } | null> {
    return this.prisma.currency.findFirst({
      where: { code, isActive: true },
      select: { code: true },
    });
  }

  async findManyByWorkspace(
    workspaceId: string,
    status: AccountStatus,
  ): Promise<AccountRecord[]> {
    return this.prisma.account.findMany({
      where: {
        workspaceId,
        status,
      },
      include: accountInclude,
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  async findById(
    workspaceId: string,
    accountId: string,
  ): Promise<AccountRecord | null> {
    return this.prisma.account.findFirst({
      where: {
        workspaceId,
        id: accountId,
      },
      include: accountInclude,
    });
  }

  async create(
    workspaceId: string,
    data: CreateAccountData,
    profile: ValidatedAccountProfilePayload | null,
  ): Promise<AccountRecord> {
    return this.prisma.$transaction(async (tx) => {
      const initialBalance = data.initialBalance ?? 0;

      const account = await tx.account.create({
        data: {
          workspaceId,
          name: data.name,
          type: data.type,
          currencyCode: data.currencyCode,
          initialBalance,
          currentBalanceCached: initialBalance,
          includeInReports: data.includeInReports ?? true,
          notes: data.notes,
        },
      });

      await this.persistProfile(tx, account.id, profile);

      return this.findByIdForType(tx, workspaceId, account.id, account.type);
    });
  }

  async update(
    workspaceId: string,
    accountId: string,
    data: UpdateAccountData,
    profile: ValidatedAccountProfilePayload | null | undefined,
  ): Promise<AccountRecord> {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.update({
        where: { id: accountId, workspaceId },
        data,
        select: { type: true },
      });

      if (profile !== undefined) {
        await this.persistProfile(tx, accountId, profile);
      }

      return this.findByIdForType(tx, workspaceId, accountId, account.type);
    });
  }

  async updateStatus(
    workspaceId: string,
    accountId: string,
    status: AccountStatus,
  ): Promise<AccountRecord> {
    await this.prisma.account.update({
      where: { id: accountId, workspaceId },
      data: { status },
    });

    return this.prisma.account.findFirstOrThrow({
      where: {
        workspaceId,
        id: accountId,
      },
      include: accountInclude,
    });
  }

  private async persistProfile(
    tx: Prisma.TransactionClient,
    accountId: string,
    profile: ValidatedAccountProfilePayload | null,
  ): Promise<void> {
    if (!profile) {
      return;
    }

    await getAccountTypeDefinitionByProfileKind(profile.kind).persistProfile(
      tx,
      accountId,
      profile.data,
    );
  }

  private async findByIdForType(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    accountId: string,
    type: AccountType,
  ): Promise<AccountRecord> {
    const where = {
      workspaceId,
      id: accountId,
    } as const;
    const profileRelation = getAccountTypeDefinition(type).profileRelation;

    if (!profileRelation) {
      return this.normalizeAccountRecord(
        await tx.account.findFirstOrThrow({ where }),
      );
    }

    return this.normalizeAccountRecord(
      await tx.account.findFirstOrThrow({
        where,
        include: { [profileRelation]: true },
      }),
    );
  }

  private normalizeAccountRecord(
    account: AccountRecordWithOptionalProfiles,
  ): AccountRecord {
    return {
      ...account,
      creditCardProfile: account.creditCardProfile ?? null,
      debtProfile: account.debtProfile ?? null,
      loanProfile: account.loanProfile ?? null,
      lentMoneyProfile: account.lentMoneyProfile ?? null,
    };
  }
}
