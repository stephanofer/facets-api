import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@config/config.module';
import { DatabaseModule } from '@database/database.module';
import { PrismaService } from '@database/prisma.service';
import {
  AccountStatus,
  AccountType,
  PlatformRole,
  TransactionDirection,
  UserStatus,
  WorkspaceMembershipStatus,
  WorkspaceRole,
  WorkspaceStatus,
  WorkspaceType,
} from '@/generated/prisma/client';
import { AccountBalancesRepository } from '@modules/account-balances/account-balances.repository';
import { AccountBalancesService } from '@modules/account-balances/account-balances.service';
import { AccountBalanceRecomputeService } from '@modules/account-balances/domain/account-balance-recompute.service';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';

describe('AccountBalances module (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let service: AccountBalancesService;
  let repository: AccountBalancesRepository;

  const createdWorkspaceIds = new Set<string>();
  const createdUserIds = new Set<string>();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [
        AccountBalancesRepository,
        AccountBalanceRecomputeService,
        AccountBalancesService,
      ],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(AccountBalancesService);
    repository = moduleRef.get(AccountBalancesRepository);

    await prisma.$connect();

    await prisma.currency.upsert({
      where: { code: 'ARS' },
      update: {
        name: 'Argentine Peso',
        symbol: '$',
        decimalScale: 2,
        isActive: true,
      },
      create: {
        code: 'ARS',
        name: 'Argentine Peso',
        symbol: '$',
        decimalScale: 2,
        isActive: true,
      },
    });
  });

  afterEach(async () => {
    for (const workspaceId of createdWorkspaceIds) {
      await cleanupWorkspace(workspaceId);
    }

    createdWorkspaceIds.clear();
    createdUserIds.clear();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await moduleRef.close();
  });

  async function cleanupWorkspace(workspaceId: string): Promise<void> {
    const accounts = await prisma.account.findMany({
      where: { workspaceId },
      select: { id: true },
    });
    const accountIds = accounts.map((account) => account.id);

    if (accountIds.length > 0) {
      await prisma.accountDailyBalance.deleteMany({
        where: { accountId: { in: accountIds } },
      });
      await prisma.accountReconciliation.deleteMany({
        where: { accountId: { in: accountIds } },
      });
      await prisma.transactionTag.deleteMany({
        where: { transaction: { workspaceId } },
      });
      await prisma.transfer.deleteMany({ where: { workspaceId } });
      await prisma.transaction.deleteMany({ where: { workspaceId } });
      await prisma.creditCardProfile.deleteMany({
        where: { accountId: { in: accountIds } },
      });
      await prisma.loanProfile.deleteMany({
        where: { accountId: { in: accountIds } },
      });
      await prisma.debtProfile.deleteMany({
        where: { accountId: { in: accountIds } },
      });
      await prisma.lentMoneyProfile.deleteMany({
        where: { accountId: { in: accountIds } },
      });
      await prisma.account.deleteMany({ where: { id: { in: accountIds } } });
    }

    await prisma.workspaceMembership.deleteMany({ where: { workspaceId } });
    await prisma.workspaceSettings.deleteMany({ where: { workspaceId } });
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({
      where: { id: { in: [...createdUserIds] } },
    });
  }

  async function createPrincipalFixture(
    label: string,
    role = WorkspaceRole.ADMIN,
  ): Promise<{ principal: AuthenticatedPrincipal; accountId: string }> {
    const workspace = await prisma.workspace.create({
      data: {
        name: `balances-${label}-${Date.now()}`,
        type: WorkspaceType.PERSONAL,
        status: WorkspaceStatus.ACTIVE,
      },
    });

    createdWorkspaceIds.add(workspace.id);

    const user = await prisma.user.create({
      data: {
        email: `${label}-${Date.now()}@test.com`,
        password: 'hashed',
        firstName: 'Balance',
        lastName: 'Tester',
        status: UserStatus.ACTIVE,
        emailVerified: true,
        platformRole: PlatformRole.USER,
      },
    });

    createdUserIds.add(user.id);

    const membership = await prisma.workspaceMembership.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role,
        status: WorkspaceMembershipStatus.ACTIVE,
      },
    });

    await prisma.workspaceSettings.create({
      data: { workspaceId: workspace.id },
    });

    const account = await prisma.account.create({
      data: {
        workspaceId: workspace.id,
        name: `Cuenta ${label}`,
        type: AccountType.BANK,
        currencyCode: 'ARS',
        initialBalance: 100,
        currentBalanceCached: 100,
        status: AccountStatus.ACTIVE,
      },
    });

    return {
      principal: {
        sub: user.id,
        actorUserId: user.id,
        email: user.email,
        workspaceId: workspace.id,
        membershipId: membership.id,
        workspaceRole: membership.role,
        platformRole: user.platformRole,
        user,
        workspace,
        membership,
      },
      accountId: account.id,
    };
  }

  it('keeps repository reads scoped by Account.workspaceId', async () => {
    const owner = await createPrincipalFixture('owner');
    const outsider = await createPrincipalFixture('outsider');

    await prisma.accountReconciliation.create({
      data: {
        accountId: owner.accountId,
        createdByUserId: owner.principal.actorUserId,
        date: new Date('2026-03-26T00:00:00.000Z'),
        targetBalance: 1150,
      },
    });

    const hidden = await repository.findReconciliations(
      outsider.principal.workspaceId,
      owner.accountId,
    );
    const visible = await repository.findReconciliations(
      owner.principal.workspaceId,
      owner.accountId,
    );

    expect(hidden).toEqual([]);
    expect(visible).toHaveLength(1);
  });

  it('recomputes snapshots and keeps cache aligned for summary and timeline reads', async () => {
    const fixture = await createPrincipalFixture('timeline');

    await prisma.transaction.createMany({
      data: [
        {
          workspaceId: fixture.principal.workspaceId,
          accountId: fixture.accountId,
          date: new Date('2026-03-25T00:00:00.000Z'),
          amount: 40,
          direction: TransactionDirection.INFLOW,
          currencyCode: 'ARS',
          description: 'Ingreso',
        },
        {
          workspaceId: fixture.principal.workspaceId,
          accountId: fixture.accountId,
          date: new Date('2026-03-26T00:00:00.000Z'),
          amount: 10,
          direction: TransactionDirection.OUTFLOW,
          currencyCode: 'ARS',
          description: 'Gasto',
        },
      ],
    });

    await service.createReconciliation(fixture.principal, fixture.accountId, {
      date: new Date('2026-03-26T00:00:00.000Z'),
      targetBalance: 115,
      reason: 'Saldo real',
    });

    const timeline = await service.getDailyBalances(
      fixture.principal,
      fixture.accountId,
      {
        from: new Date('2026-03-25T00:00:00.000Z'),
        to: new Date('2026-03-26T00:00:00.000Z'),
      },
    );
    const summary = await service.getBalanceSummary(
      fixture.principal,
      fixture.accountId,
    );
    const account = await prisma.account.findUniqueOrThrow({
      where: { id: fixture.accountId },
    });

    expect(timeline).toEqual([
      expect.objectContaining({
        date: '2026-03-25',
        openingBalance: '100',
        inflowsAmount: '40',
        outflowsAmount: '0',
        adjustmentsAmount: '0',
        closingBalance: '140',
      }),
      expect.objectContaining({
        date: '2026-03-26',
        openingBalance: '140',
        inflowsAmount: '0',
        outflowsAmount: '10',
        adjustmentsAmount: '-15',
        calculatedBalance: '130',
        closingBalance: '115',
        difference: '-15',
      }),
    ]);
    expect(summary).toMatchObject({
      currentBalance: '115',
      calculatedBalance: '130',
      reconciledBalance: '115',
      difference: '-15',
      hasDifference: true,
      lastSnapshotDate: '2026-03-26',
    });
    expect(account.currentBalanceCached.toString()).toBe('115');
  });

  it('realigns snapshots and cache after updating and deleting the effective reconciliation', async () => {
    const fixture = await createPrincipalFixture('recompute');

    await prisma.transaction.create({
      data: {
        workspaceId: fixture.principal.workspaceId,
        accountId: fixture.accountId,
        date: new Date('2026-03-28T00:00:00.000Z'),
        amount: 30,
        direction: TransactionDirection.OUTFLOW,
        currencyCode: 'ARS',
        description: 'Salida',
      },
    });

    const created = await service.createReconciliation(
      fixture.principal,
      fixture.accountId,
      {
        date: new Date('2026-03-28T00:00:00.000Z'),
        targetBalance: 50,
      },
    );

    await service.updateReconciliation(
      fixture.principal,
      fixture.accountId,
      created.id,
      {
        targetBalance: 65,
      },
    );

    let summary = await service.getBalanceSummary(
      fixture.principal,
      fixture.accountId,
    );
    expect(summary.reconciledBalance).toBe('65');
    expect(summary.difference).toBe('-5');

    await service.deleteReconciliation(
      fixture.principal,
      fixture.accountId,
      created.id,
    );

    summary = await service.getBalanceSummary(
      fixture.principal,
      fixture.accountId,
    );

    expect(summary.reconciledBalance).toBe('70');
    expect(summary.calculatedBalance).toBe('70');
    expect(summary.difference).toBe('0');
    expect(summary.hasDifference).toBe(false);
  });
});
