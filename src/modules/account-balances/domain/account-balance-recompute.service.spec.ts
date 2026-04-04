/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, TransactionDirection } from '@/generated/prisma/client';
import { AccountBalancesRepository } from '@modules/account-balances/account-balances.repository';
import { AccountBalanceRecomputeService } from '@modules/account-balances/domain/account-balance-recompute.service';

describe('AccountBalanceRecomputeService', () => {
  let service: AccountBalanceRecomputeService;
  let moduleRef: TestingModule;
  let repository: jest.Mocked<AccountBalancesRepository>;

  const tx = {} as Prisma.TransactionClient;
  const workspaceId = 'workspace-1';
  const accountId = 'account-1';

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        AccountBalanceRecomputeService,
        {
          provide: AccountBalancesRepository,
          useValue: {
            findAccountById: jest.fn(),
            findPreviousDailyBalance: jest.fn(),
            findLatestDailyBalanceFromDate: jest.fn(),
            findLatestActiveTransactionDateFrom: jest.fn(),
            findEarliestActiveTransactionDateUntil: jest.fn(),
            findLatestReconciliationDateFrom: jest.fn(),
            findEarliestReconciliationDateUntil: jest.fn(),
            deleteDailyBalancesFromDate: jest.fn(),
            findTransactionDailyAggregates: jest.fn(),
            findReconciliationsInRange: jest.fn(),
            createDailyBalances: jest.fn(),
            updateAccountCurrentBalance: jest.fn(),
            touchWorkspaceFinancialData: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AccountBalanceRecomputeService);
    repository = moduleRef.get(AccountBalancesRepository);

    repository.findAccountById.mockResolvedValue({
      id: accountId,
      workspaceId,
      currencyCode: 'ARS',
      initialBalance: new Prisma.Decimal(0),
      currentBalanceCached: new Prisma.Decimal(0),
      status: 'ACTIVE',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    } as never);
    repository.findPreviousDailyBalance.mockResolvedValue(null);
    repository.findLatestDailyBalanceFromDate.mockResolvedValue(null);
    repository.findLatestActiveTransactionDateFrom.mockResolvedValue(null);
    repository.findEarliestActiveTransactionDateUntil.mockResolvedValue(null);
    repository.findLatestReconciliationDateFrom.mockResolvedValue(null);
    repository.findEarliestReconciliationDateUntil.mockResolvedValue(null);
    repository.findTransactionDailyAggregates.mockResolvedValue([]);
    repository.findReconciliationsInRange.mockResolvedValue([]);
    repository.deleteDailyBalancesFromDate.mockResolvedValue();
    repository.createDailyBalances.mockResolvedValue();
    repository.updateAccountCurrentBalance.mockResolvedValue();
    repository.touchWorkspaceFinancialData.mockResolvedValue();
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('materializes a reconciled day using adjustments instead of fake transactions', async () => {
    repository.findAccountById.mockResolvedValue({
      id: accountId,
      workspaceId,
      currencyCode: 'ARS',
      initialBalance: new Prisma.Decimal(1200),
      currentBalanceCached: new Prisma.Decimal(1200),
      status: 'ACTIVE',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    } as never);
    repository.findLatestReconciliationDateFrom.mockResolvedValue(
      new Date('2026-03-26T00:00:00.000Z'),
    );
    repository.findReconciliationsInRange.mockResolvedValue([
      {
        id: 'reconciliation-1',
        date: new Date('2026-03-26T00:00:00.000Z'),
        targetBalance: new Prisma.Decimal(1150),
        createdAt: new Date('2026-03-26T18:00:00.000Z'),
      },
    ] as never);

    const result = await service.recomputeFromDate(
      accountId,
      workspaceId,
      new Date('2026-03-26T12:00:00.000Z'),
      tx,
    );

    expect(repository.createDailyBalances).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          openingBalance: new Prisma.Decimal(1200),
          inflowsAmount: new Prisma.Decimal(0),
          outflowsAmount: new Prisma.Decimal(0),
          adjustmentsAmount: new Prisma.Decimal(-50),
          closingBalance: new Prisma.Decimal(1150),
        }),
      ],
      tx,
    );
    expect(repository.updateAccountCurrentBalance).toHaveBeenCalledWith(
      workspaceId,
      accountId,
      new Prisma.Decimal(1150),
      tx,
    );
    expect(result.currentBalance.toString()).toBe('1150');
  });

  it('materializes a day without reconciliation from pure cashflow', async () => {
    repository.findAccountById.mockResolvedValue({
      id: accountId,
      workspaceId,
      currencyCode: 'ARS',
      initialBalance: new Prisma.Decimal(100),
      currentBalanceCached: new Prisma.Decimal(100),
      status: 'ACTIVE',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    } as never);
    repository.findLatestActiveTransactionDateFrom.mockResolvedValue(
      new Date('2026-03-27T00:00:00.000Z'),
    );
    repository.findTransactionDailyAggregates.mockResolvedValue([
      {
        date: new Date('2026-03-27T00:00:00.000Z'),
        direction: TransactionDirection.INFLOW,
        amount: new Prisma.Decimal(40),
      },
      {
        date: new Date('2026-03-27T00:00:00.000Z'),
        direction: TransactionDirection.OUTFLOW,
        amount: new Prisma.Decimal(10),
      },
    ]);

    await service.recomputeFromDate(
      accountId,
      workspaceId,
      new Date('2026-03-27T00:00:00.000Z'),
      tx,
    );

    expect(repository.createDailyBalances).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          openingBalance: new Prisma.Decimal(100),
          inflowsAmount: new Prisma.Decimal(40),
          outflowsAmount: new Prisma.Decimal(10),
          adjustmentsAmount: new Prisma.Decimal(0),
          closingBalance: new Prisma.Decimal(130),
        }),
      ],
      tx,
    );
  });

  it('uses createdAt and id ordering to choose the effective reconciliation for a day', async () => {
    repository.findAccountById.mockResolvedValue({
      id: accountId,
      workspaceId,
      currencyCode: 'ARS',
      initialBalance: new Prisma.Decimal(100),
      currentBalanceCached: new Prisma.Decimal(100),
      status: 'ACTIVE',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    } as never);
    repository.findLatestReconciliationDateFrom.mockResolvedValue(
      new Date('2026-03-28T00:00:00.000Z'),
    );
    repository.findReconciliationsInRange.mockResolvedValue([
      {
        id: 'reconciliation-b',
        date: new Date('2026-03-28T00:00:00.000Z'),
        targetBalance: new Prisma.Decimal(95),
        createdAt: new Date('2026-03-28T18:00:00.000Z'),
      },
      {
        id: 'reconciliation-a',
        date: new Date('2026-03-28T00:00:00.000Z'),
        targetBalance: new Prisma.Decimal(90),
        createdAt: new Date('2026-03-28T18:00:00.000Z'),
      },
    ] as never);

    await service.recomputeFromDate(
      accountId,
      workspaceId,
      new Date('2026-03-28T00:00:00.000Z'),
      tx,
    );

    expect(repository.createDailyBalances).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          adjustmentsAmount: new Prisma.Decimal(-5),
          closingBalance: new Prisma.Decimal(95),
        }),
      ],
      tx,
    );
  });

  it('recomputes retroactively by chaining from the previous snapshot forward', async () => {
    repository.findAccountById.mockResolvedValue({
      id: accountId,
      workspaceId,
      currencyCode: 'ARS',
      initialBalance: new Prisma.Decimal(0),
      currentBalanceCached: new Prisma.Decimal(0),
      status: 'ACTIVE',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    } as never);
    repository.findPreviousDailyBalance.mockResolvedValue({
      id: 'snapshot-prev',
      accountId,
      date: new Date('2026-03-27T00:00:00.000Z'),
      currencyCode: 'ARS',
      openingBalance: new Prisma.Decimal(0),
      inflowsAmount: new Prisma.Decimal(0),
      outflowsAmount: new Prisma.Decimal(0),
      adjustmentsAmount: new Prisma.Decimal(0),
      closingBalance: new Prisma.Decimal(100),
      createdAt: new Date('2026-03-27T00:00:00.000Z'),
      updatedAt: new Date('2026-03-27T00:00:00.000Z'),
    } as never);
    repository.findLatestActiveTransactionDateFrom.mockResolvedValue(
      new Date('2026-03-29T00:00:00.000Z'),
    );
    repository.findTransactionDailyAggregates.mockResolvedValue([
      {
        date: new Date('2026-03-28T00:00:00.000Z'),
        direction: TransactionDirection.OUTFLOW,
        amount: new Prisma.Decimal(10),
      },
      {
        date: new Date('2026-03-29T00:00:00.000Z'),
        direction: TransactionDirection.INFLOW,
        amount: new Prisma.Decimal(20),
      },
    ]);

    const result = await service.recomputeFromDate(
      accountId,
      workspaceId,
      new Date('2026-03-28T00:00:00.000Z'),
      tx,
    );

    expect(repository.createDailyBalances).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          date: new Date('2026-03-28T00:00:00.000Z'),
          openingBalance: new Prisma.Decimal(100),
          closingBalance: new Prisma.Decimal(90),
        }),
        expect.objectContaining({
          date: new Date('2026-03-29T00:00:00.000Z'),
          openingBalance: new Prisma.Decimal(90),
          closingBalance: new Prisma.Decimal(110),
        }),
      ],
      tx,
    );
    expect(result.currentBalance.toString()).toBe('110');
    expect(result.snapshotCount).toBe(2);
  });
});
