/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { Prisma, WorkspaceRole } from '@/generated/prisma/client';
import { ERROR_CODES } from '@common/constants/app.constants';
import { AccountBalancesRepository } from '@modules/account-balances/account-balances.repository';
import { AccountBalancesService } from '@modules/account-balances/account-balances.service';
import { AccountBalanceRecomputeService } from '@modules/account-balances/domain/account-balance-recompute.service';
import { PrismaService } from '@database/prisma.service';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';

describe('AccountBalancesService', () => {
  let service: AccountBalancesService;
  let moduleRef: TestingModule;
  let prisma: { $transaction: jest.Mock };
  let repository: jest.Mocked<AccountBalancesRepository>;
  let recomputeService: jest.Mocked<AccountBalanceRecomputeService>;

  const principal = {
    sub: 'user-1',
    actorUserId: 'user-1',
    email: 'owner@test.com',
    workspaceId: 'workspace-1',
    membershipId: 'membership-1',
    workspaceRole: WorkspaceRole.ADMIN,
    platformRole: 'USER',
    user: {} as AuthenticatedPrincipal['user'],
    workspace: {} as AuthenticatedPrincipal['workspace'],
    membership: {} as AuthenticatedPrincipal['membership'],
  } as AuthenticatedPrincipal;

  const account = {
    id: 'account-1',
    workspaceId: principal.workspaceId,
    currencyCode: 'ARS',
    initialBalance: new Prisma.Decimal(100),
    currentBalanceCached: new Prisma.Decimal(100),
    status: 'ACTIVE',
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-01T00:00:00.000Z'),
  };

  const reconciliationRecord = {
    id: 'reconciliation-1',
    accountId: account.id,
    createdByUserId: principal.actorUserId,
    createdByUser: {
      id: principal.actorUserId,
      email: principal.email,
      firstName: 'Owner',
      lastName: 'User',
    },
    date: new Date('2026-03-26T00:00:00.000Z'),
    targetBalance: new Prisma.Decimal(1150),
    reason: 'Saldo real del banco',
    createdAt: new Date('2026-03-26T10:00:00.000Z'),
    updatedAt: new Date('2026-03-26T10:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(
        (callback: (tx: Prisma.TransactionClient) => unknown) =>
          Promise.resolve(callback({} as Prisma.TransactionClient)),
      ),
    };

    moduleRef = await Test.createTestingModule({
      providers: [
        AccountBalancesService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: AccountBalancesRepository,
          useValue: {
            findAccountById: jest.fn(),
            createReconciliation: jest.fn(),
            findReconciliationsByDate: jest.fn(),
            findReconciliations: jest.fn(),
            findReconciliationById: jest.fn(),
            updateReconciliation: jest.fn(),
            deleteReconciliation: jest.fn(),
            findLatestDailyBalance: jest.fn(),
            findDailyBalancesInRange: jest.fn(),
          },
        },
        {
          provide: AccountBalanceRecomputeService,
          useValue: {
            recomputeFromDate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AccountBalancesService);
    repository = moduleRef.get(AccountBalancesRepository);
    recomputeService = moduleRef.get(AccountBalanceRecomputeService);

    repository.findAccountById.mockResolvedValue(account as never);
    repository.createReconciliation.mockResolvedValue(
      reconciliationRecord as never,
    );
    repository.findReconciliationsByDate.mockResolvedValue([
      reconciliationRecord,
    ] as never);
    repository.findReconciliations.mockResolvedValue([
      reconciliationRecord,
    ] as never);
    repository.findReconciliationById.mockResolvedValue(
      reconciliationRecord as never,
    );
    repository.updateReconciliation.mockResolvedValue(
      reconciliationRecord as never,
    );
    repository.deleteReconciliation.mockResolvedValue();
    repository.findLatestDailyBalance.mockResolvedValue(null);
    repository.findDailyBalancesInRange.mockResolvedValue([]);
    recomputeService.recomputeFromDate.mockResolvedValue({
      snapshotCount: 1,
      throughDate: new Date('2026-03-26T00:00:00.000Z'),
      currentBalance: new Prisma.Decimal(1150),
    });
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('creates a reconciliation and triggers inline recompute without creating transactions', async () => {
    const result = await service.createReconciliation(principal, account.id, {
      date: new Date('2026-03-26T00:00:00.000Z'),
      targetBalance: 1150,
      reason: 'Saldo real del banco',
    });

    expect(repository.createReconciliation).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: account.id,
        createdByUserId: principal.actorUserId,
        targetBalance: 1150,
      }),
      expect.anything(),
    );
    expect(recomputeService.recomputeFromDate).toHaveBeenCalledWith(
      account.id,
      principal.workspaceId,
      new Date('2026-03-26T00:00:00.000Z'),
      expect.anything(),
    );
    expect(repository.deleteReconciliation).not.toHaveBeenCalled();
    expect(result.isEffective).toBe(true);
  });

  it('returns list results with effective status per day', async () => {
    repository.findReconciliations.mockResolvedValue([
      reconciliationRecord,
      {
        ...reconciliationRecord,
        id: 'reconciliation-older',
        createdAt: new Date('2026-03-26T08:00:00.000Z'),
      },
      {
        ...reconciliationRecord,
        id: 'reconciliation-next-day',
        date: new Date('2026-03-27T00:00:00.000Z'),
      },
    ] as never);

    const result = await service.listReconciliations(principal, account.id);

    expect(result).toHaveLength(3);
    expect(result[0].isEffective).toBe(true);
    expect(result[1].isEffective).toBe(false);
    expect(result[2].isEffective).toBe(true);
  });

  it('updates a reconciliation and recomputes from the earliest affected date', async () => {
    await service.updateReconciliation(
      principal,
      account.id,
      reconciliationRecord.id,
      {
        date: new Date('2026-03-24T00:00:00.000Z'),
        targetBalance: 1100,
      },
    );

    expect(repository.updateReconciliation).toHaveBeenCalledWith(
      reconciliationRecord.id,
      expect.objectContaining({ targetBalance: 1100 }),
      expect.anything(),
    );
    expect(recomputeService.recomputeFromDate).toHaveBeenCalledWith(
      account.id,
      principal.workspaceId,
      new Date('2026-03-24T00:00:00.000Z'),
      expect.anything(),
    );
  });

  it('deletes the effective reconciliation and recomputes the same day', async () => {
    await service.deleteReconciliation(
      principal,
      account.id,
      reconciliationRecord.id,
    );

    expect(repository.deleteReconciliation).toHaveBeenCalledWith(
      reconciliationRecord.id,
      expect.anything(),
    );
    expect(recomputeService.recomputeFromDate).toHaveBeenCalledWith(
      account.id,
      principal.workspaceId,
      reconciliationRecord.date,
      expect.anything(),
    );
  });

  it('hides foreign workspace reconciliations with ACCOUNT_RECONCILIATION_NOT_FOUND', async () => {
    repository.findReconciliationById.mockResolvedValue(null);

    await expect(
      service.getReconciliationById(
        principal,
        account.id,
        'foreign-reconciliation',
      ),
    ).rejects.toMatchObject({
      code: ERROR_CODES.ACCOUNT_RECONCILIATION_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('rejects invalid date ranges for the timeline query', async () => {
    await expect(
      service.getDailyBalances(principal, account.id, {
        from: new Date('2026-03-31T00:00:00.000Z'),
        to: new Date('2026-03-01T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_ERROR,
      status: HttpStatus.BAD_REQUEST,
    });
  });
});
