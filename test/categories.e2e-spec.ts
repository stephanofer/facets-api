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

describe('Categories (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let userId: string;
  let workspaceId: string;

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

  describe('GET /api/categories', () => {
    it('should return system categories in tree structure', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.categories).toBeInstanceOf(Array);
      expect(res.body.data.total).toBeGreaterThan(0);
    });

    it('should filter by type EXPENSE', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories?type=EXPENSE')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      res.body.data.categories.forEach((c: any) => {
        expect(c.type).toBe('EXPENSE');
        c.children?.forEach((child: any) => {
          expect(child.type).toBe('EXPENSE');
        });
      });
    });

    it('should return flat list when flat=true', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories?flat=true')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      res.body.data.categories.forEach((c: any) => {
        expect(c.children).toEqual([]);
      });
    });
  });

  describe('POST /api/categories', () => {
    it('should create a custom parent category', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Custom Expense',
          type: 'EXPENSE',
          icon: 'star',
          color: '#FF6B6B',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        name: 'Custom Expense',
        type: 'EXPENSE',
        isSystem: false,
        isActive: true,
      });
    });

    it('should create a subcategory under a system parent', async () => {
      const categoriesRes = await request(app.getHttpServer())
        .get('/api/categories?type=EXPENSE')
        .set('Authorization', `Bearer ${accessToken}`);

      const systemParent = categoriesRes.body.data.categories.find(
        (c: any) => c.isSystem,
      );

      const res = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Custom Sub-Expense',
          type: 'EXPENSE',
          parentId: systemParent.id,
        })
        .expect(201);

      expect(res.body.data.parentId).toBe(systemParent.id);
    });

    it('should fail with duplicate name for same workspace and type', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Custom Expense',
          type: 'EXPENSE',
        })
        .expect(409);

      expect(res.body.error.code).toBe('CATEGORY_DUPLICATE_NAME');
    });
  });

  describe('GET /api/categories/:id', () => {
    it('should get a system category with its children', async () => {
      const categoriesRes = await request(app.getHttpServer())
        .get('/api/categories?type=EXPENSE')
        .set('Authorization', `Bearer ${accessToken}`);

      const parentWithChildren = categoriesRes.body.data.categories.find(
        (c: any) => c.children && c.children.length > 0,
      );

      const res = await request(app.getHttpServer())
        .get(`/api/categories/${parentWithChildren.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(parentWithChildren.id);
    });
  });

  describe('workspace isolation and role enforcement', () => {
    let otherUserToken: string;
    let otherUserId: string;
    let guestToken: string;
    let guestUserId: string;
    let myCustomCategoryId: string;

    beforeAll(async () => {
      const otherUser = await createTestUser(app, {
        email: `e2e-cat-other-${Date.now()}@test.com`,
      });
      otherUserToken = otherUser.accessToken;
      otherUserId = otherUser.userId;

      const guest = await createWorkspaceMember(
        app,
        workspaceId,
        WorkspaceRole.GUEST,
        {
          email: `e2e-cat-guest-${Date.now()}@test.com`,
        },
      );
      guestToken = guest.accessToken;
      guestUserId = guest.userId;

      const res = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'My Private Category', type: 'EXPENSE' })
        .expect(201);
      myCustomCategoryId = res.body.data.id;
    });

    afterAll(async () => {
      await cleanupTestUser(app, otherUserId);
      await cleanupTestUser(app, guestUserId);
    });

    it('should NOT allow another workspace to view my custom category', async () => {
      await request(app.getHttpServer())
        .get(`/api/categories/${myCustomCategoryId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(404);
    });

    it('should NOT show my custom categories in another workspace list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories?flat=true')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      const ids = res.body.data.categories.map((c: any) => c.id);
      expect(ids).not.toContain(myCustomCategoryId);
    });

    it('should still allow another workspace to see system categories', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      const systemCategories = res.body.data.categories.filter(
        (c: any) => c.isSystem,
      );
      expect(systemCategories.length).toBeGreaterThan(0);
    });

    it('should allow guest to read workspace categories', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories?flat=true')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);

      const ids = res.body.data.categories.map((c: any) => c.id);
      expect(ids).toContain(myCustomCategoryId);
    });

    it('should deny guest category creation inside same workspace', async () => {
      await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ name: 'Guest Category', type: 'EXPENSE' })
        .expect(403);
    });

    it('should deny guest category updates inside same workspace', async () => {
      await request(app.getHttpServer())
        .put(`/api/categories/${myCustomCategoryId}`)
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ name: 'Guest Hacked' })
        .expect(403);
    });
  });
});
