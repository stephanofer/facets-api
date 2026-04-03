import { AccountType, Prisma } from '@/generated/prisma/client';
import {
  CreateCreditCardProfileDto,
  CreateDebtProfileDto,
  CreateLentMoneyProfileDto,
  CreateLoanProfileDto,
  UpdateCreditCardProfileDto,
  UpdateDebtProfileDto,
  UpdateLentMoneyProfileDto,
  UpdateLoanProfileDto,
} from '@modules/accounts/dtos/account-profile.dto';
import {
  AccountProfileKind,
  AccountTypeDefinition,
  ProfileResponseMapper,
  SpecializedAccountTypeDefinition,
} from '@modules/accounts/domain/account-type-definition.interface';

const mapNoProfile: ProfileResponseMapper = () => null;

async function persistCreditCardProfile(
  tx: Prisma.TransactionClient,
  accountId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await tx.creditCardProfile.upsert({
    where: { accountId },
    create: {
      accountId,
      ...data,
    },
    update: data,
  });
}

async function persistDebtProfile(
  tx: Prisma.TransactionClient,
  accountId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await tx.debtProfile.upsert({
    where: { accountId },
    create: {
      accountId,
      ...data,
    },
    update: data,
  });
}

async function persistLoanProfile(
  tx: Prisma.TransactionClient,
  accountId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await tx.loanProfile.upsert({
    where: { accountId },
    create: {
      accountId,
      ...data,
    },
    update: data,
  });
}

async function persistLentMoneyProfile(
  tx: Prisma.TransactionClient,
  accountId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await tx.lentMoneyProfile.upsert({
    where: { accountId },
    create: {
      accountId,
      ...data,
    },
    update: data,
  });
}

const mapCreditCardProfile: ProfileResponseMapper = ({ creditCardProfile }) => {
  if (!creditCardProfile) {
    return null;
  }

  return {
    issuerName: creditCardProfile.issuerName,
    last4: creditCardProfile.last4,
    creditLimit: creditCardProfile.creditLimit?.toString() ?? null,
    closingDayOfMonth: creditCardProfile.closingDayOfMonth,
    dueDayOfMonth: creditCardProfile.dueDayOfMonth,
  };
};

const mapDebtProfile: ProfileResponseMapper = ({ debtProfile }) => {
  if (!debtProfile) {
    return null;
  }

  return {
    creditorName: debtProfile.creditorName,
    dueDate: debtProfile.dueDate?.toISOString() ?? null,
    reference: debtProfile.reference,
    notes: debtProfile.notes,
  };
};

const mapLoanProfile: ProfileResponseMapper = ({ loanProfile }) => {
  if (!loanProfile) {
    return null;
  }

  return {
    lenderName: loanProfile.lenderName,
    interestRate: loanProfile.interestRate?.toString() ?? null,
    estimatedInstallmentAmount:
      loanProfile.estimatedInstallmentAmount?.toString() ?? null,
    termMonths: loanProfile.termMonths,
    dueDayOfMonth: loanProfile.dueDayOfMonth,
    startedAt: loanProfile.startedAt?.toISOString() ?? null,
    maturityDate: loanProfile.maturityDate?.toISOString() ?? null,
  };
};

const mapLentMoneyProfile: ProfileResponseMapper = ({ lentMoneyProfile }) => {
  if (!lentMoneyProfile) {
    return null;
  }

  return {
    borrowerName: lentMoneyProfile.borrowerName,
    expectedRepaymentDate:
      lentMoneyProfile.expectedRepaymentDate?.toISOString() ?? null,
    notes: lentMoneyProfile.notes,
  };
};

export const ACCOUNT_TYPE_DEFINITIONS: Record<
  AccountType,
  AccountTypeDefinition
> = {
  [AccountType.CASH]: {
    type: AccountType.CASH,
    profileKind: 'NONE',
    mapProfile: mapNoProfile,
  },
  [AccountType.BANK]: {
    type: AccountType.BANK,
    profileKind: 'NONE',
    mapProfile: mapNoProfile,
  },
  [AccountType.CREDIT_CARD]: {
    type: AccountType.CREDIT_CARD,
    profileKind: 'CREDIT_CARD',
    createDto: CreateCreditCardProfileDto,
    updateDto: UpdateCreditCardProfileDto,
    persistProfile: persistCreditCardProfile,
    mapProfile: mapCreditCardProfile,
  },
  [AccountType.DEBT]: {
    type: AccountType.DEBT,
    profileKind: 'DEBT',
    createDto: CreateDebtProfileDto,
    updateDto: UpdateDebtProfileDto,
    persistProfile: persistDebtProfile,
    mapProfile: mapDebtProfile,
  },
  [AccountType.LOAN]: {
    type: AccountType.LOAN,
    profileKind: 'LOAN',
    createDto: CreateLoanProfileDto,
    updateDto: UpdateLoanProfileDto,
    persistProfile: persistLoanProfile,
    mapProfile: mapLoanProfile,
  },
  [AccountType.LENT_MONEY]: {
    type: AccountType.LENT_MONEY,
    profileKind: 'LENT_MONEY',
    createDto: CreateLentMoneyProfileDto,
    updateDto: UpdateLentMoneyProfileDto,
    persistProfile: persistLentMoneyProfile,
    mapProfile: mapLentMoneyProfile,
  },
};

const ACCOUNT_TYPE_DEFINITIONS_BY_PROFILE_KIND = Object.values(
  ACCOUNT_TYPE_DEFINITIONS,
).reduce(
  (definitions, definition) => {
    if (definition.profileKind !== 'NONE') {
      definitions[definition.profileKind] =
        definition as SpecializedAccountTypeDefinition;
    }

    return definitions;
  },
  {} as Record<
    Exclude<AccountProfileKind, 'NONE'>,
    SpecializedAccountTypeDefinition
  >,
);

export function getAccountTypeDefinition(
  type: AccountType,
): AccountTypeDefinition {
  return ACCOUNT_TYPE_DEFINITIONS[type];
}

export function getAccountTypeDefinitionByProfileKind(
  profileKind: Exclude<AccountProfileKind, 'NONE'>,
): SpecializedAccountTypeDefinition {
  return ACCOUNT_TYPE_DEFINITIONS_BY_PROFILE_KIND[profileKind];
}
