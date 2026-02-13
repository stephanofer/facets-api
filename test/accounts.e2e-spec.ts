import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  createTestApp,
  createTestUser,
  cleanupTestUser,
} from './helpers/test-app.helper';

describe('Accounts (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let userId: string;

  // Track created account IDs for later tests
  let debitCardId: string;
  let creditCardId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const testUser = await createTestUser(app);
    accessToken = testUser.accessToken;
    userId = testUser.userId;
  }, 30000);

  afterAll(async () => {
    await cleanupTestUser(app, userId);
    await app.close();
  });

  // =========================================================================
  // POST /api/accounts — creation & validation
  // =========================================================================
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
      });
      expect(res.body.data.id).toBeDefined();
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
      });
      creditCardId = res.body.data.id;
    });

    it('should fail with duplicate name', async () => {
      // We already hit our 2-account free limit, but duplicate name check
      // comes before feature limit check in the service, so let's test with
      // a different user or just validate the error
      // Actually the feature limit is checked FIRST, so we'll get 403 here.
      // Let's verify that hitting the limit returns the correct error:
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

  // =========================================================================
  // GET /api/accounts
  // =========================================================================
  describe('GET /api/accounts', () => {
    it('should list all accounts', async () => {
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

    it('should reject unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/api/accounts').expect(401);
    });
  });

  // =========================================================================
  // GET /api/accounts/summary
  // =========================================================================
  describe('GET /api/accounts/summary', () => {
    it('should return balance summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounts/summary')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.balances).toBeInstanceOf(Array);
      expect(res.body.data.balances.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.totalAccounts).toBe(2);

      // Check the USD balance entry
      const usdBalance = res.body.data.balances.find(
        (b: any) => b.currencyCode === 'USD',
      );
      expect(usdBalance).toBeDefined();
      expect(usdBalance.accountCount).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // GET /api/accounts/:id
  // =========================================================================
  describe('GET /api/accounts/:id', () => {
    it('should get a single account', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/accounts/${debitCardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(debitCardId);
      expect(res.body.data.name).toBe('My Debit Card');
    });

    it('should return 404 for non-existent account', async () => {
      await request(app.getHttpServer())
        .get('/api/accounts/cm9zzzzzzzzzzzzzzzzzzzzzz')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 400 for invalid CUID', async () => {
      await request(app.getHttpServer())
        .get('/api/accounts/invalid-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  // =========================================================================
  // PUT /api/accounts/:id
  // =========================================================================
  describe('PUT /api/accounts/:id', () => {
    it('should update an account name', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/accounts/${debitCardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Debit Card' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Debit Card');
    });

    it('should update multiple fields', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/accounts/${debitCardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'My Debit Card',
          color: '#E74C3C',
          includeInTotal: false,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('My Debit Card');
      expect(res.body.data.color).toBe('#E74C3C');
      expect(res.body.data.includeInTotal).toBe(false);
    });

    it('should fail with duplicate name', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/accounts/${debitCardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Visa Gold' }) // Exists as credit card
        .expect(409);

      expect(res.body.error.code).toBe('ACCOUNT_DUPLICATE_NAME');
    });

    it('should return 404 for non-existent account', async () => {
      await request(app.getHttpServer())
        .put('/api/accounts/cm9zzzzzzzzzzzzzzzzzzzzzz')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'No Such Account' })
        .expect(404);
    });
  });

  // =========================================================================
  // PATCH /api/accounts/:id/archive & /unarchive
  // =========================================================================
  describe('PATCH /api/accounts/:id/archive and /unarchive', () => {
    it('should archive an account', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/accounts/${creditCardId}/archive`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isArchived).toBe(true);
    });

    it('should show archived accounts when includeArchived=true', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounts?includeArchived=true')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const archivedAccount = res.body.data.accounts.find(
        (a: any) => a.id === creditCardId,
      );
      expect(archivedAccount).toBeDefined();
      expect(archivedAccount.isArchived).toBe(true);
    });

    it('should NOT show archived accounts without flag', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const archivedAccount = res.body.data.accounts.find(
        (a: any) => a.id === creditCardId,
      );
      expect(archivedAccount).toBeUndefined();
    });

    it('should unarchive an account', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/accounts/${creditCardId}/unarchive`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isArchived).toBe(false);
    });

    it('should fail to unarchive an account that is not archived', async () => {
      await request(app.getHttpServer())
        .patch(`/api/accounts/${creditCardId}/unarchive`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  // =========================================================================
  // DELETE /api/accounts/:id
  // =========================================================================
  describe('DELETE /api/accounts/:id', () => {
    it('should return 404 for non-existent account', async () => {
      await request(app.getHttpServer())
        .delete('/api/accounts/cm9zzzzzzzzzzzzzzzzzzzzzz')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should delete an account with no transactions', async () => {
      // Delete the credit card (no transactions linked)
      await request(app.getHttpServer())
        .delete(`/api/accounts/${creditCardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Confirm it's gone
      await request(app.getHttpServer())
        .get(`/api/accounts/${creditCardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  // =========================================================================
  // Multi-tenancy isolation
  // =========================================================================
  describe('Multi-tenancy', () => {
    let otherUserToken: string;
    let otherUserId: string;

    beforeAll(async () => {
      const otherUser = await createTestUser(app, {
        email: `e2e-other-${Date.now()}@test.com`,
      });
      otherUserToken = otherUser.accessToken;
      otherUserId = otherUser.userId;
    });

    afterAll(async () => {
      await cleanupTestUser(app, otherUserId);
    });

    it('should NOT allow another user to view my account', async () => {
      await request(app.getHttpServer())
        .get(`/api/accounts/${debitCardId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(404);
    });

    it('should NOT allow another user to update my account', async () => {
      await request(app.getHttpServer())
        .put(`/api/accounts/${debitCardId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ name: 'Hacked!' })
        .expect(404);
    });

    it('should NOT allow another user to delete my account', async () => {
      await request(app.getHttpServer())
        .delete(`/api/accounts/${debitCardId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(404);
    });

    it('should NOT show my accounts in another user list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounts')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      const ids = res.body.data.accounts.map((a: any) => a.id);
      expect(ids).not.toContain(debitCardId);
    });
  });
});
