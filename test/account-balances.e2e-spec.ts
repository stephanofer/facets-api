import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaService } from '@database/prisma.service';
import { ApiResponse } from '@common/interfaces/api-response.interface';
import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  cleanupTestUser,
  createTestApp,
  createTestUser,
  createWorkspaceMember,
} from './helpers/test-app.helper';
import {
  AccountStatus,
  AccountType,
  TransactionDirection,
  WorkspaceRole,
} from '@/generated/prisma/client';

function getSuccessBody<T>(response: request.Response): ApiResponse<T> {
  return response.body as ApiResponse<T>;
}

function getErrorBody(response: request.Response): {
  success: boolean;
  error: {
    code: string;
    message: string;
  };
} {
  return response.body as {
    success: boolean;
    error: {
      code: string;
      message: string;
    };
  };
}

describe('Account Balances (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminUserId: string;
  let workspaceId: string;
  let adminToken: string;
  let memberUserId: string;
  let memberToken: string;
  let guestUserId: string;
  let guestToken: string;
  let outsiderUserId: string;
  let outsiderToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const admin = await createTestUser(app, {
      email: `account-balances-admin-${Date.now()}@test.com`,
    });
    adminUserId = admin.userId;
    workspaceId = admin.workspaceId;
    adminToken = admin.accessToken;

    const member = await createWorkspaceMember(
      app,
      workspaceId,
      WorkspaceRole.MEMBER,
      { email: `account-balances-member-${Date.now()}@test.com` },
    );
    memberUserId = member.userId;
    memberToken = member.accessToken;

    const guest = await createWorkspaceMember(
      app,
      workspaceId,
      WorkspaceRole.GUEST,
      { email: `account-balances-guest-${Date.now()}@test.com` },
    );
    guestUserId = guest.userId;
    guestToken = guest.accessToken;

    const outsider = await createTestUser(app, {
      email: `account-balances-outsider-${Date.now()}@test.com`,
    });
    outsiderUserId = outsider.userId;
    outsiderToken = outsider.accessToken;
  }, 30000);

  afterAll(async () => {
    if (app) {
      await cleanupTestUser(app, memberUserId);
      await cleanupTestUser(app, guestUserId);
      await cleanupTestUser(app, outsiderUserId);
      await cleanupTestUser(app, adminUserId);
      await app.close();
    }
  });

  async function createAccount(name: string): Promise<string> {
    const account = await prisma.account.create({
      data: {
        workspaceId,
        name,
        type: AccountType.BANK,
        currencyCode: 'ARS',
        initialBalance: 100,
        currentBalanceCached: 100,
        status: AccountStatus.ACTIVE,
      },
    });

    return account.id;
  }

  it('documents the new endpoints in Swagger and keeps them out of Accounts Core', () => {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Facets API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);

    expect(
      document.paths['/api/v1/accounts/{accountId}/reconciliations'],
    ).toBeDefined();
    expect(
      document.paths['/api/v1/accounts/{accountId}/balance-summary'],
    ).toBeDefined();
    expect(
      document.paths['/api/v1/accounts/{accountId}/daily-balances'],
    ).toBeDefined();
  });

  it('supports full reconciliation CRUD with envelope, roles, and timeline reads', async () => {
    const accountId = await createAccount(`Cuenta e2e ${Date.now()}`);

    await prisma.transaction.createMany({
      data: [
        {
          workspaceId,
          accountId,
          date: new Date('2026-03-25T00:00:00.000Z'),
          amount: 40,
          direction: TransactionDirection.INFLOW,
          currencyCode: 'ARS',
          description: 'Ingreso',
        },
        {
          workspaceId,
          accountId,
          date: new Date('2026-03-26T00:00:00.000Z'),
          amount: 10,
          direction: TransactionDirection.OUTFLOW,
          currencyCode: 'ARS',
          description: 'Gasto',
        },
      ],
    });

    const created = await request(app.getHttpServer())
      .post(`/api/v1/accounts/${accountId}/reconciliations`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        date: '2026-03-26',
        targetBalance: 115,
        reason: 'Saldo real',
      })
      .expect(201);

    const createdBody = getSuccessBody<{
      id: string;
      isEffective: boolean;
      targetBalance: string;
    }>(created);
    expect(createdBody.success).toBe(true);
    expect(createdBody.data).toMatchObject({
      targetBalance: '115',
      isEffective: true,
    });

    const reconciliationId = createdBody.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/accounts/${accountId}/reconciliations`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        date: '2026-03-26',
        targetBalance: 120,
      })
      .expect(403);

    const list = await request(app.getHttpServer())
      .get(`/api/v1/accounts/${accountId}/reconciliations`)
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);

    expect(getSuccessBody<Array<{ id: string }>>(list).data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: reconciliationId }),
      ]),
    );

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/accounts/${accountId}/reconciliations/${reconciliationId}`)
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);
    const detailBody = getSuccessBody<{
      reason: string | null;
      author: { email: string } | null;
    }>(detail).data;

    expect(detailBody).toMatchObject({
      reason: 'Saldo real',
    });
    expect(detailBody.author?.email).toContain('@test.com');

    const summary = await request(app.getHttpServer())
      .get(`/api/v1/accounts/${accountId}/balance-summary`)
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);

    expect(
      getSuccessBody<{
        currentBalance: string;
        calculatedBalance: string;
        reconciledBalance: string;
        difference: string;
      }>(summary).data,
    ).toMatchObject({
      currentBalance: '115',
      calculatedBalance: '130',
      reconciledBalance: '115',
      difference: '-15',
    });

    const timeline = await request(app.getHttpServer())
      .get(
        `/api/v1/accounts/${accountId}/daily-balances?from=2026-03-25&to=2026-03-26`,
      )
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);

    expect(
      getSuccessBody<
        Array<{
          date: string;
          openingBalance: string;
          closingBalance: string;
          calculatedBalance: string;
          difference: string;
        }>
      >(timeline).data,
    ).toEqual([
      expect.objectContaining({
        date: '2026-03-25',
        openingBalance: '100',
        closingBalance: '140',
        calculatedBalance: '140',
        difference: '0',
      }),
      expect.objectContaining({
        date: '2026-03-26',
        openingBalance: '140',
        closingBalance: '115',
        calculatedBalance: '130',
        difference: '-15',
      }),
    ]);

    const updated = await request(app.getHttpServer())
      .patch(
        `/api/v1/accounts/${accountId}/reconciliations/${reconciliationId}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ targetBalance: 120 })
      .expect(200);

    expect(
      getSuccessBody<{ reconciledBalance?: string; targetBalance: string }>(
        updated,
      ).data.targetBalance,
    ).toBe('120');

    const updatedSummary = await request(app.getHttpServer())
      .get(`/api/v1/accounts/${accountId}/balance-summary`)
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);

    expect(
      getSuccessBody<{ reconciledBalance: string; difference: string }>(
        updatedSummary,
      ).data,
    ).toMatchObject({
      reconciledBalance: '120',
      difference: '-10',
    });

    await request(app.getHttpServer())
      .delete(
        `/api/v1/accounts/${accountId}/reconciliations/${reconciliationId}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    const deletedSummary = await request(app.getHttpServer())
      .get(`/api/v1/accounts/${accountId}/balance-summary`)
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);

    expect(
      getSuccessBody<{ reconciledBalance: string; difference: string }>(
        deletedSummary,
      ).data,
    ).toMatchObject({
      reconciledBalance: '130',
      difference: '0',
    });
  });

  it('keeps foreign workspace data isolated with ACCOUNT_NOT_FOUND', async () => {
    const accountId = await createAccount(`Cuenta privada ${Date.now()}`);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/accounts/${accountId}/balance-summary`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(404);

    const body = getErrorBody(response);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('ACCOUNT_NOT_FOUND');
  });
});
