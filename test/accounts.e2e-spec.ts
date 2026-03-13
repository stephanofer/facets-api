import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  cleanupTestUser,
  createTestApp,
  createTestUser,
  createWorkspaceMember,
} from './helpers/test-app.helper';
import { WorkspaceRole } from '../src/generated/prisma/client';

describe('Accounts (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let userId: string;
  let workspaceId: string;

  let debitCardId: string;
  let creditCardId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const testUser = await createTestUser(app);
    accessToken = testUser.accessToken;
    userId = testUser.userId;
    workspaceId = testUser.workspaceId;
  }, 30000);

  afterAll(async () => {
    await cleanupTestUser(app, userId);
    await app.close();
  });

  describe('POST /api/accounts', () => {
    it('should reject unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post('/api/accounts')
        .send({ name: 'No Auth', type: 'CASH' })
        .expect(401);
    });

    it('should fail with invalid currency code format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Invalid Currency',
          type: 'CASH',
          currencyCode: 'INVALID',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail if non-CREDIT_CARD has credit card fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Bad Cash',
          type: 'CASH',
          creditLimit: 5000,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDIT_CARD_FIELDS');
    });

    it('should fail if CREDIT_CARD is missing creditLimit', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Bad Credit Card',
          type: 'CREDIT_CARD',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDIT_CARD_FIELDS');
    });

    it('should create a DEBIT_CARD account', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'My Debit Card',
          type: 'DEBIT_CARD',
          balance: 1500.5,
          currencyCode: 'USD',
          color: '#3498DB',
          icon: 'credit-card',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        name: 'My Debit Card',
        type: 'DEBIT_CARD',
        balance: '1500.5',
        currencyCode: 'USD',
        color: '#3498DB',
        icon: 'credit-card',
        includeInTotal: true,
        isArchived: false,
        createdByUserId: userId,
        updatedByUserId: userId,
      });
      debitCardId = res.body.data.id;
    });

    it('should create a CREDIT_CARD account with credit limit', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Visa Gold',
          type: 'CREDIT_CARD',
          balance: -250,
          currencyCode: 'USD',
          creditLimit: 5000,
          statementClosingDay: 15,
          paymentDueDay: 5,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        name: 'Visa Gold',
        type: 'CREDIT_CARD',
        balance: '-250',
        creditLimit: '5000',
        statementClosingDay: 15,
        paymentDueDay: 5,
        createdByUserId: userId,
        updatedByUserId: userId,
      });
      creditCardId = res.body.data.id;
    });

    it('should enforce workspace account limit', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Third Account',
          type: 'CASH',
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FEATURE_LIMIT_EXCEEDED');
    });
  });

  describe('GET /api/accounts', () => {
    it('should list all accounts for the current workspace', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accounts).toBeInstanceOf(Array);
      expect(res.body.data.accounts.length).toBe(2);
      expect(res.body.data.total).toBe(2);
    });

    it('should filter by type', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounts?type=CREDIT_CARD')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accounts.length).toBe(1);
      expect(res.body.data.accounts[0].type).toBe('CREDIT_CARD');
    });

    it('should hide archived accounts by default', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      res.body.data.accounts.forEach((account: any) => {
        expect(account.isArchived).toBe(false);
      });
    });
  });

  describe('GET /api/accounts/summary', () => {
    it('should return balance summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounts/summary')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.balances).toBeInstanceOf(Array);
      expect(res.body.data.totalAccounts).toBe(2);
    });
  });

  describe('GET /api/accounts/:id', () => {
    it('should get a single account', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/accounts/${debitCardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(debitCardId);
    });
  });

  describe('PUT /api/accounts/:id', () => {
    it('should update an account name', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/accounts/${debitCardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Debit Card' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Debit Card');
      expect(res.body.data.updatedByUserId).toBe(userId);
    });
  });

  describe('PATCH /api/accounts/:id/archive and /unarchive', () => {
    it('should archive an account', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/accounts/${creditCardId}/archive`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isArchived).toBe(true);
      expect(res.body.data.updatedByUserId).toBe(userId);
    });

    it('should unarchive an account', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/accounts/${creditCardId}/unarchive`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isArchived).toBe(false);
      expect(res.body.data.updatedByUserId).toBe(userId);
    });
  });

  describe('DELETE /api/accounts/:id', () => {
    it('should delete an account with no transactions', async () => {
      await request(app.getHttpServer())
        .delete(`/api/accounts/${creditCardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/accounts/${creditCardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('workspace isolation and role enforcement', () => {
    let otherUserToken: string;
    let otherUserId: string;
    let guestToken: string;
    let guestUserId: string;

    beforeAll(async () => {
      const otherUser = await createTestUser(app, {
        email: `e2e-other-${Date.now()}@test.com`,
      });
      otherUserToken = otherUser.accessToken;
      otherUserId = otherUser.userId;

      const guest = await createWorkspaceMember(
        app,
        workspaceId,
        WorkspaceRole.GUEST,
        {
          email: `e2e-guest-${Date.now()}@test.com`,
        },
      );
      guestToken = guest.accessToken;
      guestUserId = guest.userId;
    });

    afterAll(async () => {
      await cleanupTestUser(app, otherUserId);
      await cleanupTestUser(app, guestUserId);
    });

    it('should NOT allow another workspace to view my account', async () => {
      await request(app.getHttpServer())
        .get(`/api/accounts/${debitCardId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(404);
    });

    it('should NOT show my accounts in another workspace list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounts')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      const ids = res.body.data.accounts.map((a: any) => a.id);
      expect(ids).not.toContain(debitCardId);
    });

    it('should allow guest to read workspace accounts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounts')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);

      const ids = res.body.data.accounts.map((a: any) => a.id);
      expect(ids).toContain(debitCardId);
    });

    it('should deny guest account creation inside same workspace', async () => {
      await request(app.getHttpServer())
        .post('/api/accounts')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ name: 'Guest Attempt', type: 'CASH' })
        .expect(403);
    });

    it('should deny guest account updates inside same workspace', async () => {
      await request(app.getHttpServer())
        .put(`/api/accounts/${debitCardId}`)
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ name: 'Guest Hacked' })
        .expect(403);
    });
  });
});
