import { INestApplication } from '@nestjs/common';
import { ApiResponse } from '@common/interfaces/api-response.interface';
import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  cleanupTestUser,
  createTestApp,
  createTestUser,
  createWorkspaceMember,
} from './helpers/test-app.helper';
import { AccountResponseDto } from '@/modules/accounts/dtos/account-response.dto';
import {
  AccountStatus,
  AccountType,
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
    details?: Array<{ field?: string; message: string }>;
  };
} {
  return response.body as {
    success: boolean;
    error: {
      code: string;
      message: string;
      details?: Array<{ field?: string; message: string }>;
    };
  };
}

describe('Accounts (e2e)', () => {
  let app: INestApplication<App>;
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

    const admin = await createTestUser(app, {
      email: `accounts-admin-${Date.now()}@test.com`,
    });
    adminUserId = admin.userId;
    workspaceId = admin.workspaceId;
    adminToken = admin.accessToken;

    const member = await createWorkspaceMember(
      app,
      workspaceId,
      WorkspaceRole.MEMBER,
      { email: `accounts-member-${Date.now()}@test.com` },
    );
    memberUserId = member.userId;
    memberToken = member.accessToken;

    const guest = await createWorkspaceMember(
      app,
      workspaceId,
      WorkspaceRole.GUEST,
      { email: `accounts-guest-${Date.now()}@test.com` },
    );
    guestUserId = guest.userId;
    guestToken = guest.accessToken;

    const outsider = await createTestUser(app, {
      email: `accounts-outsider-${Date.now()}@test.com`,
    });
    outsiderUserId = outsider.userId;
    outsiderToken = outsider.accessToken;
  }, 30000);

  afterAll(async () => {
    await cleanupTestUser(app, memberUserId);
    await cleanupTestUser(app, guestUserId);
    await cleanupTestUser(app, outsiderUserId);
    await cleanupTestUser(app, adminUserId);
    await app.close();
  });

  it('creates a credit-card account and documents the typed profile in the response envelope', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Visa hogar',
        type: AccountType.CREDIT_CARD,
        currencyCode: 'ARS',
        includeInReports: false,
        notes: 'Uso familiar',
        profile: {
          issuerName: 'Visa',
          last4: '1234',
          creditLimit: 5000,
          closingDayOfMonth: 25,
          dueDayOfMonth: 10,
        },
      })
      .expect(201);

    const body = getSuccessBody<AccountResponseDto>(response);

    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      name: 'Visa hogar',
      type: AccountType.CREDIT_CARD,
      currencyCode: 'ARS',
      includeInReports: false,
      status: AccountStatus.ACTIVE,
      profile: {
        issuerName: 'Visa',
        last4: '1234',
        creditLimit: '5000',
        closingDayOfMonth: 25,
        dueDayOfMonth: 10,
      },
    });
    expect(body.data).not.toHaveProperty('initialBalance');
    expect(body.data).not.toHaveProperty('currentBalanceCached');
  });

  it('returns only ACTIVE accounts by default and allows archive/reactivate explicitly', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Caja viaje',
        type: AccountType.CASH,
        currencyCode: 'ARS',
        includeInReports: false,
      })
      .expect(201);

    const accountId = getSuccessBody<AccountResponseDto>(created).data.id;

    await request(app.getHttpServer())
      .patch(`/api/accounts/${accountId}/archive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const defaultList = await request(app.getHttpServer())
      .get('/api/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const defaultBody = getSuccessBody<AccountResponseDto[]>(defaultList);
    expect(defaultBody.data.some((account) => account.id === accountId)).toBe(
      false,
    );

    const archivedList = await request(app.getHttpServer())
      .get('/api/accounts?status=ARCHIVED')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const archivedBody = getSuccessBody<AccountResponseDto[]>(archivedList);
    expect(archivedBody.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: accountId,
          status: AccountStatus.ARCHIVED,
          includeInReports: false,
        }),
      ]),
    );

    const reactivated = await request(app.getHttpServer())
      .patch(`/api/accounts/${accountId}/reactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(getSuccessBody<AccountResponseDto>(reactivated).data).toMatchObject({
      id: accountId,
      status: AccountStatus.ACTIVE,
      includeInReports: false,
    });
  });

  it('lets members mutate accounts but keeps guests read-only', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        name: 'Banco miembro',
        type: AccountType.BANK,
        currencyCode: 'ARS',
      })
      .expect(201);

    const accountId = getSuccessBody<AccountResponseDto>(created).data.id;

    await request(app.getHttpServer())
      .patch(`/api/accounts/${accountId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ notes: 'Actualizada por miembro' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        name: 'Cuenta guest',
        type: AccountType.CASH,
        currencyCode: 'ARS',
      })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/accounts/${accountId}`)
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);
  });

  it('rejects incompatible specialized profiles with ACCOUNT_PROFILE_INCOMPATIBLE', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Banco incompatible',
        type: AccountType.BANK,
        currencyCode: 'ARS',
        profile: {
          lenderName: 'Banco Nación',
          termMonths: 24,
        },
      })
      .expect(400);

    const errorBody = getErrorBody(response);

    expect(errorBody.success).toBe(false);
    expect(errorBody.error.code).toBe('ACCOUNT_PROFILE_INCOMPATIBLE');
  });

  it('rejects invalid credit-card last4 validation at runtime', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Visa inválida',
        type: AccountType.CREDIT_CARD,
        currencyCode: 'ARS',
        profile: {
          issuerName: 'Visa',
          last4: '12A4',
        },
      })
      .expect(400);

    const errorBody = getErrorBody(response);
    const last4Error = errorBody.error.details?.find(
      (detail) => detail.field === 'profile.last4',
    );

    expect(errorBody.success).toBe(false);
    expect(errorBody.error.code).toBe('VALIDATION_ERROR');
    expect(last4Error?.message).toContain('exactly 4 digits');
  });

  it('rejects deferred lent-money status fields as unsupported in this phase', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Préstamo a Juan',
        type: AccountType.LENT_MONEY,
        currencyCode: 'ARS',
        profile: {
          borrowerName: 'Juan Pérez',
          status: 'SETTLED',
        },
      })
      .expect(400);

    const errorBody = getErrorBody(response);
    const statusError = errorBody.error.details?.find(
      (detail) => detail.field === 'profile.status',
    );

    expect(errorBody.success).toBe(false);
    expect(errorBody.error.code).toBe('VALIDATION_ERROR');
    expect(statusError?.message).toContain('should not exist');
  });

  it('keeps account detail hidden from foreign workspaces with ACCOUNT_NOT_FOUND', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Banco privado',
        type: AccountType.BANK,
        currencyCode: 'ARS',
      })
      .expect(201);

    const accountId = getSuccessBody<AccountResponseDto>(created).data.id;

    const response = await request(app.getHttpServer())
      .get(`/api/accounts/${accountId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(404);

    const errorBody = getErrorBody(response);

    expect(errorBody.success).toBe(false);
    expect(errorBody.error.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('rejects immutable field changes explicitly instead of silently ignoring them', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Banco inmutable',
        type: AccountType.BANK,
        currencyCode: 'ARS',
      })
      .expect(201);

    const accountId = getSuccessBody<AccountResponseDto>(created).data.id;

    const response = await request(app.getHttpServer())
      .patch(`/api/accounts/${accountId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ currencyCode: 'USD' })
      .expect(409);

    const errorBody = getErrorBody(response);

    expect(errorBody.success).toBe(false);
    expect(errorBody.error.code).toBe('ACCOUNT_FIELD_IMMUTABLE');
  });
});
