import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@config/config.module';
import { DatabaseModule } from '@database/database.module';
import { PrismaService } from '@database/prisma.service';
import { AccountsRepository } from '@modules/accounts/accounts.repository';
import {
  AccountStatus,
  AccountType,
  WorkspaceType,
} from '@/generated/prisma/client';

describe('AccountsRepository (integration)', () => {
  let moduleRef: TestingModule;
  let repository: AccountsRepository;
  let prisma: PrismaService;

  const createdWorkspaceIds = new Set<string>();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [AccountsRepository],
    }).compile();

    repository = moduleRef.get(AccountsRepository);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    await prisma.currency.upsert({
      where: { code: 'USD' },
      update: {
        name: 'US Dollar',
        symbol: '$',
        decimalScale: 2,
        isActive: true,
      },
      create: {
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
        decimalScale: 2,
        isActive: true,
      },
    });

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
      await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    }

    createdWorkspaceIds.clear();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await moduleRef.close();
  });

  async function createWorkspace(name: string): Promise<string> {
    const workspace = await prisma.workspace.create({
      data: {
        name,
        type: WorkspaceType.PERSONAL,
      },
    });

    createdWorkspaceIds.add(workspace.id);
    return workspace.id;
  }

  it('creates a no-profile account without specialized profile rows', async () => {
    const workspaceId = await createWorkspace(`cash-${Date.now()}`);

    const result = await repository.create(
      workspaceId,
      {
        name: 'Caja chica',
        type: AccountType.CASH,
        currencyCode: 'ARS',
        initialBalance: 350,
        includeInReports: true,
        notes: 'Operativa',
      },
      null,
    );

    expect(result.workspaceId).toBe(workspaceId);
    expect(result.type).toBe(AccountType.CASH);
    expect(result.creditCardProfile).toBeNull();
    expect(result.loanProfile).toBeNull();
    expect(result.debtProfile).toBeNull();
    expect(result.lentMoneyProfile).toBeNull();
  });

  it('keeps reads scoped by workspace predicates', async () => {
    const workspaceA = await createWorkspace(`ws-a-${Date.now()}`);
    const workspaceB = await createWorkspace(`ws-b-${Date.now()}`);

    const account = await repository.create(
      workspaceA,
      {
        name: 'Banco A',
        type: AccountType.BANK,
        currencyCode: 'ARS',
      },
      null,
    );

    const hidden = await repository.findById(workspaceB, account.id);
    const visible = await repository.findById(workspaceA, account.id);

    expect(hidden).toBeNull();
    expect(visible?.id).toBe(account.id);
  });

  it('updates the specialized profile through sequential transaction writes', async () => {
    const workspaceId = await createWorkspace(`cc-${Date.now()}`);

    const created = await repository.create(
      workspaceId,
      {
        name: 'Visa hogar',
        type: AccountType.CREDIT_CARD,
        currencyCode: 'ARS',
        includeInReports: false,
      },
      {
        kind: 'CREDIT_CARD',
        data: {
          issuerName: 'Visa',
          last4: '1234',
          creditLimit: 5000,
          closingDayOfMonth: 25,
          dueDayOfMonth: 10,
        },
      },
    );

    const updated = await repository.update(
      workspaceId,
      created.id,
      {
        notes: 'Tarjeta hogar',
      },
      {
        kind: 'CREDIT_CARD',
        data: {
          issuerName: 'Visa Platinum',
          last4: '4321',
          creditLimit: 6500,
          closingDayOfMonth: 26,
          dueDayOfMonth: 11,
        },
      },
    );

    expect(updated.notes).toBe('Tarjeta hogar');
    expect(updated.creditCardProfile).toMatchObject({
      issuerName: 'Visa Platinum',
      last4: '4321',
      closingDayOfMonth: 26,
      dueDayOfMonth: 11,
    });
    expect(updated.creditCardProfile?.creditLimit?.toString()).toBe('6500');
  });

  it('filters list results by workspace and lifecycle status', async () => {
    const workspaceId = await createWorkspace(`list-${Date.now()}`);

    const active = await repository.create(
      workspaceId,
      {
        name: 'Banco sueldo',
        type: AccountType.BANK,
        currencyCode: 'ARS',
      },
      null,
    );

    await repository.create(
      workspaceId,
      {
        name: 'Préstamo auto',
        type: AccountType.LOAN,
        currencyCode: 'ARS',
      },
      null,
    );

    await repository.updateStatus(
      workspaceId,
      active.id,
      AccountStatus.ARCHIVED,
    );

    const activeAccounts = await repository.findManyByWorkspace(
      workspaceId,
      AccountStatus.ACTIVE,
    );
    const archivedAccounts = await repository.findManyByWorkspace(
      workspaceId,
      AccountStatus.ARCHIVED,
    );

    expect(activeAccounts).toHaveLength(1);
    expect(activeAccounts[0].status).toBe(AccountStatus.ACTIVE);
    expect(archivedAccounts).toHaveLength(1);
    expect(archivedAccounts[0].id).toBe(active.id);
  });

  it('keeps downstream financial artifacts out of scope when creating an account', async () => {
    const workspaceId = await createWorkspace(`boundary-${Date.now()}`);

    const created = await repository.create(
      workspaceId,
      {
        name: 'Cuenta foundation',
        type: AccountType.BANK,
        currencyCode: 'ARS',
        initialBalance: 1200,
      },
      null,
    );

    const [dailyBalancesCount, reconciliationsCount, transactionsCount] =
      await Promise.all([
        prisma.accountDailyBalance.count({ where: { accountId: created.id } }),
        prisma.accountReconciliation.count({
          where: { accountId: created.id },
        }),
        prisma.transaction.count({ where: { accountId: created.id } }),
      ]);

    expect(dailyBalancesCount).toBe(0);
    expect(reconciliationsCount).toBe(0);
    expect(transactionsCount).toBe(0);
  });
});
