/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@common/constants/app.constants';
import { BusinessException } from '@common/exceptions/business.exception';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import { AccountsRepository } from '@modules/accounts/accounts.repository';
import { AccountsService } from '@modules/accounts/accounts.service';
import { AccountProfilePayloadValidator } from '@modules/accounts/domain/account-profile-payload.validator';
import {
  AccountStatus,
  AccountType,
  PlatformRole,
  UserStatus,
  WorkspaceMembershipStatus,
  WorkspaceRole,
  WorkspaceStatus,
  WorkspaceType,
} from '@/generated/prisma/client';

describe('AccountsService', () => {
  let service: AccountsService;
  let moduleRef: TestingModule;
  let repository: jest.Mocked<AccountsRepository>;
  let profileValidator: jest.Mocked<AccountProfilePayloadValidator>;

  const workspaceId = 'workspace_accounts';
  const principal: AuthenticatedPrincipal = {
    sub: 'user-1',
    email: 'accounts@test.com',
    workspaceId,
    actorUserId: 'user-1',
    membershipId: 'membership-1',
    workspaceRole: WorkspaceRole.ADMIN,
    platformRole: PlatformRole.USER,
    user: {
      id: 'user-1',
      email: 'accounts@test.com',
      password: 'hashed',
      firstName: 'Accounts',
      lastName: 'Admin',
      emailVerified: true,
      emailVerifiedAt: new Date('2026-04-03T00:00:00.000Z'),
      status: UserStatus.ACTIVE,
      platformRole: PlatformRole.USER,
      createdAt: new Date('2026-04-03T00:00:00.000Z'),
      updatedAt: new Date('2026-04-03T00:00:00.000Z'),
      deletedAt: null,
    },
    workspace: {
      id: workspaceId,
      name: 'Workspace Accounts',
      type: WorkspaceType.PERSONAL,
      status: WorkspaceStatus.ACTIVE,
      financialDataUpdatedAt: new Date('2026-04-03T00:00:00.000Z'),
      createdAt: new Date('2026-04-03T00:00:00.000Z'),
      updatedAt: new Date('2026-04-03T00:00:00.000Z'),
    },
    membership: {
      id: 'membership-1',
      workspaceId,
      userId: 'user-1',
      role: WorkspaceRole.ADMIN,
      status: WorkspaceMembershipStatus.ACTIVE,
      invitedAt: null,
      joinedAt: new Date('2026-04-03T00:00:00.000Z'),
      invitedByUserId: null,
      createdAt: new Date('2026-04-03T00:00:00.000Z'),
      updatedAt: new Date('2026-04-03T00:00:00.000Z'),
    },
  };

  const accountRecord = {
    id: 'account-1',
    workspaceId,
    name: 'Banco sueldo',
    type: AccountType.BANK,
    currencyCode: 'ARS',
    initialBalance: '1500.25',
    currentBalanceCached: '1500.25',
    status: AccountStatus.ACTIVE,
    includeInReports: true,
    notes: 'Cuenta principal',
    createdAt: new Date('2026-04-03T10:00:00.000Z'),
    updatedAt: new Date('2026-04-03T10:00:00.000Z'),
    creditCardProfile: null,
    debtProfile: null,
    loanProfile: null,
    lentMoneyProfile: null,
  };

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: AccountsRepository,
          useValue: {
            findSupportedCurrency: jest.fn(),
            findManyByWorkspace: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: AccountProfilePayloadValidator,
          useValue: {
            validateForCreate: jest.fn(),
            validateForUpdate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AccountsService);
    repository = moduleRef.get(AccountsRepository);
    profileValidator = moduleRef.get(AccountProfilePayloadValidator);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('lists only ACTIVE accounts by default inside the principal workspace', async () => {
    repository.findManyByWorkspace.mockResolvedValue([accountRecord] as never);

    const result = await service.list(principal, {});

    expect(repository.findManyByWorkspace).toHaveBeenCalledWith(
      workspaceId,
      AccountStatus.ACTIVE,
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: accountRecord.id,
        type: AccountType.BANK,
        currencyCode: 'ARS',
        profile: null,
      }),
    ]);
    expect(result[0]).not.toHaveProperty('initialBalance');
    expect(result[0]).not.toHaveProperty('currentBalanceCached');
  });

  it('creates an account in the current workspace after validating currency and profile policy', async () => {
    repository.findSupportedCurrency.mockResolvedValue({
      code: 'ARS',
    } as never);
    profileValidator.validateForCreate.mockReturnValue(null);
    repository.create.mockResolvedValue(accountRecord as never);

    const result = await service.create(principal, {
      name: 'Banco sueldo',
      type: AccountType.BANK,
      currencyCode: 'ARS',
      initialBalance: 1500.25,
      includeInReports: true,
      notes: 'Cuenta principal',
    });

    expect(repository.create).toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({
        name: 'Banco sueldo',
        type: AccountType.BANK,
        currencyCode: 'ARS',
        initialBalance: 1500.25,
      }),
      null,
    );
    expect(result.id).toBe(accountRecord.id);
  });

  it('rejects create requests with unsupported currencies', async () => {
    repository.findSupportedCurrency.mockResolvedValue(null);

    await expect(
      service.create(principal, {
        name: 'Cuenta rara',
        type: AccountType.CASH,
        currencyCode: 'ZZZ',
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.ACCOUNT_CURRENCY_UNSUPPORTED,
      status: HttpStatus.BAD_REQUEST,
    });
  });

  it('rejects immutable field changes on standard updates', async () => {
    await expect(
      service.update(principal, accountRecord.id, {
        currencyCode: 'USD',
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.ACCOUNT_FIELD_IMMUTABLE,
      status: HttpStatus.CONFLICT,
      details: [
        { field: 'currencyCode', message: 'currencyCode is immutable' },
      ],
    });
  });

  it('returns ACCOUNT_NOT_FOUND when detail is requested from another workspace', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.getById(principal, 'foreign-account')).rejects.toThrow(
      new BusinessException(
        ERROR_CODES.ACCOUNT_NOT_FOUND,
        'Account not found',
        HttpStatus.NOT_FOUND,
      ),
    );
  });

  it('archives an active account and preserves report metadata', async () => {
    repository.findById.mockResolvedValue(accountRecord as never);
    repository.updateStatus.mockResolvedValue({
      ...accountRecord,
      status: AccountStatus.ARCHIVED,
      includeInReports: false,
    } as never);

    const result = await service.archive(principal, accountRecord.id);

    expect(repository.updateStatus).toHaveBeenCalledWith(
      workspaceId,
      accountRecord.id,
      AccountStatus.ARCHIVED,
    );
    expect(result.status).toBe(AccountStatus.ARCHIVED);
    expect(result.includeInReports).toBe(false);
  });

  it('reactivates an archived account', async () => {
    repository.findById.mockResolvedValue({
      ...accountRecord,
      status: AccountStatus.ARCHIVED,
    } as never);
    repository.updateStatus.mockResolvedValue(accountRecord as never);

    const result = await service.reactivate(principal, accountRecord.id);

    expect(repository.updateStatus).toHaveBeenCalledWith(
      workspaceId,
      accountRecord.id,
      AccountStatus.ACTIVE,
    );
    expect(result.status).toBe(AccountStatus.ACTIVE);
  });

  it('rejects archive when the account is already archived', async () => {
    repository.findById.mockResolvedValue({
      ...accountRecord,
      status: AccountStatus.ARCHIVED,
    } as never);

    await expect(
      service.archive(principal, accountRecord.id),
    ).rejects.toMatchObject({
      code: ERROR_CODES.ACCOUNT_ALREADY_ARCHIVED,
      status: HttpStatus.CONFLICT,
    });
  });

  it('rejects reactivate when the account is already active', async () => {
    repository.findById.mockResolvedValue(accountRecord as never);

    await expect(
      service.reactivate(principal, accountRecord.id),
    ).rejects.toMatchObject({
      code: ERROR_CODES.ACCOUNT_ALREADY_ACTIVE,
      status: HttpStatus.CONFLICT,
    });
  });
});
