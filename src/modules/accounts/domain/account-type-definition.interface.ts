import { ClassConstructor } from 'class-transformer';
import {
  AccountType,
  CreditCardProfile,
  DebtProfile,
  LoanProfile,
  LentMoneyProfile,
  Prisma,
} from '@/generated/prisma/client';
import {
  CreditCardProfileResponseDto,
  DebtProfileResponseDto,
  LentMoneyProfileResponseDto,
  LoanProfileResponseDto,
} from '@modules/accounts/dtos/account-profile.dto';

export type AccountProfileKind =
  | 'NONE'
  | 'CREDIT_CARD'
  | 'DEBT'
  | 'LOAN'
  | 'LENT_MONEY';

export interface AccountTypeDefinition {
  type: AccountType;
  profileKind: AccountProfileKind;
  profileRelation?: keyof AccountProfileRelations;
  createDto?: ClassConstructor<object>;
  updateDto?: ClassConstructor<object>;
  persistProfile?: ProfilePersistenceHandler;
  mapProfile: ProfileResponseMapper;
}

export interface AccountProfileRelations {
  creditCardProfile: CreditCardProfile | null;
  debtProfile: DebtProfile | null;
  loanProfile: LoanProfile | null;
  lentMoneyProfile: LentMoneyProfile | null;
}

export type AccountProfileResponse =
  | CreditCardProfileResponseDto
  | DebtProfileResponseDto
  | LoanProfileResponseDto
  | LentMoneyProfileResponseDto
  | null;

export type ProfilePersistenceHandler = (
  tx: Prisma.TransactionClient,
  accountId: string,
  data: Record<string, unknown>,
) => Promise<void>;

export type ProfileResponseMapper = (
  profiles: AccountProfileRelations,
) => AccountProfileResponse;

export type SpecializedAccountTypeDefinition = AccountTypeDefinition & {
  profileKind: Exclude<AccountProfileKind, 'NONE'>;
  persistProfile: ProfilePersistenceHandler;
};

export interface ValidatedAccountProfilePayload {
  kind: Exclude<AccountProfileKind, 'NONE'>;
  data: Record<string, unknown>;
}
