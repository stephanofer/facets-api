import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  createTestApp,
  createTestUser,
  cleanupTestUser,
} from './helpers/test-app.helper';

describe('Categories (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let userId: string;

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
  // GET /api/categories — system categories (always available)
  // =========================================================================
  describe('GET /api/categories (system categories)', () => {
    it('should return system categories in tree structure', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.categories).toBeInstanceOf(Array);
      expect(res.body.data.total).toBeGreaterThan(0);

      // Should have parent categories with children
      const withChildren = res.body.data.categories.filter(
        (c: any) => c.children && c.children.length > 0,
      );
      expect(withChildren.length).toBeGreaterThan(0);
    });

    it('should filter by type EXPENSE', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories?type=EXPENSE')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      // All returned categories should be EXPENSE type
      res.body.data.categories.forEach((c: any) => {
        expect(c.type).toBe('EXPENSE');
        c.children?.forEach((child: any) => {
          expect(child.type).toBe('EXPENSE');
        });
      });
    });

    it('should filter by type INCOME', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories?type=INCOME')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      res.body.data.categories.forEach((c: any) => {
        expect(c.type).toBe('INCOME');
      });
    });

    it('should return flat list when flat=true', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories?flat=true')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      // In flat mode, every category should have an empty children array
      res.body.data.categories.forEach((c: any) => {
        expect(c.children).toEqual([]);
      });
    });

    it('should reject unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/api/categories').expect(401);
    });
  });

  // =========================================================================
  // POST /api/categories — custom categories
  // =========================================================================
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
        icon: 'star',
        color: '#FF6B6B',
        isSystem: false,
        isActive: true,
      });
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.parentId).toBeUndefined();
    });

    it('should create a subcategory under a system parent', async () => {
      // Get a system parent category
      const categoriesRes = await request(app.getHttpServer())
        .get('/api/categories?type=EXPENSE')
        .set('Authorization', `Bearer ${accessToken}`);

      const systemParent = categoriesRes.body.data.categories.find(
        (c: any) => c.isSystem && c.children?.length >= 0,
      );
      expect(systemParent).toBeDefined();

      const res = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Custom Sub-Expense',
          type: 'EXPENSE',
          parentId: systemParent.id,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.parentId).toBe(systemParent.id);
      expect(res.body.data.isSystem).toBe(false);
    });

    it('should create an INCOME custom category', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Custom Income',
          type: 'INCOME',
          icon: 'dollar',
          color: '#2ECC71',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('INCOME');
    });

    it('should fail with duplicate name for same type', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Custom Expense',
          type: 'EXPENSE',
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CATEGORY_DUPLICATE_NAME');
    });

    it('should fail with parent type mismatch', async () => {
      // Get an EXPENSE parent
      const categoriesRes = await request(app.getHttpServer())
        .get('/api/categories?type=EXPENSE')
        .set('Authorization', `Bearer ${accessToken}`);

      const expenseParent = categoriesRes.body.data.categories.find(
        (c: any) => c.isSystem,
      );

      const res = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Income Under Expense',
          type: 'INCOME', // Mismatch!
          parentId: expenseParent.id,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CATEGORY_PARENT_TYPE_MISMATCH');
    });

    it('should fail with invalid color format', async () => {
      await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Bad Color',
          type: 'EXPENSE',
          color: 'red',
        })
        .expect(400);
    });

    it('should reject unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post('/api/categories')
        .send({ name: 'No Auth', type: 'EXPENSE' })
        .expect(401);
    });
  });

  // =========================================================================
  // GET /api/categories/:id
  // =========================================================================
  describe('GET /api/categories/:id', () => {
    it('should get a system category with its children', async () => {
      const categoriesRes = await request(app.getHttpServer())
        .get('/api/categories?type=EXPENSE')
        .set('Authorization', `Bearer ${accessToken}`);

      const parentWithChildren = categoriesRes.body.data.categories.find(
        (c: any) => c.children && c.children.length > 0,
      );
      expect(parentWithChildren).toBeDefined();

      const res = await request(app.getHttpServer())
        .get(`/api/categories/${parentWithChildren.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(parentWithChildren.id);
      expect(res.body.data.children).toBeInstanceOf(Array);
    });

    it('should get a custom category', async () => {
      // Get custom categories
      const categoriesRes = await request(app.getHttpServer())
        .get('/api/categories?flat=true')
        .set('Authorization', `Bearer ${accessToken}`);

      const customCategory = categoriesRes.body.data.categories.find(
        (c: any) => !c.isSystem,
      );

      if (customCategory) {
        const res = await request(app.getHttpServer())
          .get(`/api/categories/${customCategory.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.isSystem).toBe(false);
      }
    });

    it('should return 404 for non-existent category', async () => {
      await request(app.getHttpServer())
        .get('/api/categories/cm9zzzzzzzzzzzzzzzzzzzzzz')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 400 for invalid CUID', async () => {
      await request(app.getHttpServer())
        .get('/api/categories/not-a-cuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  // =========================================================================
  // PUT /api/categories/:id
  // =========================================================================
  describe('PUT /api/categories/:id', () => {
    let customCategoryId: string;
    let systemCategoryId: string;

    beforeAll(async () => {
      // Find a custom category
      const categoriesRes = await request(app.getHttpServer())
        .get('/api/categories?flat=true')
        .set('Authorization', `Bearer ${accessToken}`);

      const customCategory = categoriesRes.body.data.categories.find(
        (c: any) => !c.isSystem && !c.parentId,
      );
      customCategoryId = customCategory?.id;

      const systemCategory = categoriesRes.body.data.categories.find(
        (c: any) => c.isSystem,
      );
      systemCategoryId = systemCategory?.id;
    });

    it('should update a custom category', async () => {
      if (!customCategoryId) return;

      const res = await request(app.getHttpServer())
        .put(`/api/categories/${customCategoryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated Custom Category',
          color: '#9B59B6',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Custom Category');
      expect(res.body.data.color).toBe('#9B59B6');
    });

    it('should NOT allow updating a system category', async () => {
      if (!systemCategoryId) return;

      await request(app.getHttpServer())
        .put(`/api/categories/${systemCategoryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Hacked System Category' })
        .expect(403);
    });

    it('should return 404 for non-existent category', async () => {
      await request(app.getHttpServer())
        .put('/api/categories/cm9zzzzzzzzzzzzzzzzzzzzzz')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Ghost' })
        .expect(404);
    });
  });

  // =========================================================================
  // PATCH /api/categories/:id/deactivate & /reactivate
  // =========================================================================
  describe('PATCH /api/categories/:id/deactivate and /reactivate', () => {
    let customCategoryId: string;
    let systemCategoryId: string;

    beforeAll(async () => {
      // Create a category to deactivate
      const createRes = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'To Deactivate', type: 'EXPENSE' });
      customCategoryId = createRes.body.data.id;

      // Get a system category
      const categoriesRes = await request(app.getHttpServer())
        .get('/api/categories?flat=true&type=EXPENSE')
        .set('Authorization', `Bearer ${accessToken}`);
      const systemCat = categoriesRes.body.data.categories.find(
        (c: any) => c.isSystem,
      );
      systemCategoryId = systemCat?.id;
    });

    it('should deactivate a custom category', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/categories/${customCategoryId}/deactivate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isActive).toBe(false);
    });

    it('should hide deactivated categories by default', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories?flat=true')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const deactivated = res.body.data.categories.find(
        (c: any) => c.id === customCategoryId,
      );
      // Deactivated categories should be hidden by default
      expect(deactivated).toBeUndefined();
    });

    it('should show deactivated categories when includeInactive=true', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories?flat=true&includeInactive=true')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const deactivated = res.body.data.categories.find(
        (c: any) => c.id === customCategoryId,
      );
      expect(deactivated).toBeDefined();
      expect(deactivated.isActive).toBe(false);
    });

    it('should reactivate a deactivated category', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/categories/${customCategoryId}/reactivate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isActive).toBe(true);
    });

    it('should NOT allow deactivating a system category', async () => {
      if (!systemCategoryId) return;

      await request(app.getHttpServer())
        .patch(`/api/categories/${systemCategoryId}/deactivate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('should NOT allow reactivating a system category', async () => {
      if (!systemCategoryId) return;

      await request(app.getHttpServer())
        .patch(`/api/categories/${systemCategoryId}/reactivate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });
  });

  // =========================================================================
  // DELETE /api/categories/:id
  // =========================================================================
  describe('DELETE /api/categories/:id', () => {
    let categoryToDeleteId: string;
    let systemCategoryId: string;

    beforeAll(async () => {
      // Create a category to delete
      const createRes = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'To Delete', type: 'EXPENSE' });
      categoryToDeleteId = createRes.body.data.id;

      // Get a system category
      const categoriesRes = await request(app.getHttpServer())
        .get('/api/categories?flat=true&type=EXPENSE')
        .set('Authorization', `Bearer ${accessToken}`);
      const systemCat = categoriesRes.body.data.categories.find(
        (c: any) => c.isSystem,
      );
      systemCategoryId = systemCat?.id;
    });

    it('should delete a custom category with no transactions', async () => {
      await request(app.getHttpServer())
        .delete(`/api/categories/${categoryToDeleteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Confirm it's gone
      await request(app.getHttpServer())
        .get(`/api/categories/${categoryToDeleteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should NOT allow deleting a system category', async () => {
      if (!systemCategoryId) return;

      await request(app.getHttpServer())
        .delete(`/api/categories/${systemCategoryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent category', async () => {
      await request(app.getHttpServer())
        .delete('/api/categories/cm9zzzzzzzzzzzzzzzzzzzzzz')
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
    let myCustomCategoryId: string;

    beforeAll(async () => {
      // Create a second user
      const otherUser = await createTestUser(app, {
        email: `e2e-cat-other-${Date.now()}@test.com`,
      });
      otherUserToken = otherUser.accessToken;
      otherUserId = otherUser.userId;

      // Create a custom category as the first user
      const res = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'My Private Category', type: 'EXPENSE' });
      myCustomCategoryId = res.body.data.id;
    });

    afterAll(async () => {
      await cleanupTestUser(app, otherUserId);
    });

    it('should NOT allow another user to view my custom category', async () => {
      await request(app.getHttpServer())
        .get(`/api/categories/${myCustomCategoryId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(404);
    });

    it('should NOT allow another user to update my custom category', async () => {
      await request(app.getHttpServer())
        .put(`/api/categories/${myCustomCategoryId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ name: 'Hacked!' })
        .expect(404);
    });

    it('should NOT allow another user to delete my custom category', async () => {
      await request(app.getHttpServer())
        .delete(`/api/categories/${myCustomCategoryId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(404);
    });

    it('should NOT show my custom categories in another user list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories?flat=true')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      const ids = res.body.data.categories.map((c: any) => c.id);
      expect(ids).not.toContain(myCustomCategoryId);
    });

    it('should allow both users to see system categories', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      const systemCategories = res.body.data.categories.filter(
        (c: any) => c.isSystem,
      );
      expect(systemCategories.length).toBeGreaterThan(0);
    });
  });
});
