import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  createTestApp,
  createTestUser,
  cleanupTestUser,
} from './helpers/test-app.helper';
import { PrismaService } from '@database/prisma.service';
import { WorkspaceRole } from '../src/generated/prisma/client';

describe('Auth avatar (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;
  let workspaceId: string;
  let membershipId: string;

  const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const testUser = await createTestUser(app);
    accessToken = testUser.accessToken;
    userId = testUser.userId;
    workspaceId = testUser.workspaceId;
    membershipId = testUser.membershipId;
  }, 30000);

  afterAll(async () => {
    await cleanupTestUser(app, userId);
    await app.close();
  });

  describe('PUT /api/auth/me/avatar', () => {
    it('should upload avatar and return it in profile payload', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/auth/me/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', pngBuffer, {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.avatarUrl).toContain('/avatars/');
      expect(res.body.data).not.toHaveProperty('plan');
    });

    it('should replace previous avatar and keep only one active profile reference', async () => {
      const firstUpload = await request(app.getHttpServer())
        .put('/api/auth/me/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', pngBuffer, {
          filename: 'avatar-1.png',
          contentType: 'image/png',
        })
        .expect(200);

      const secondUpload = await request(app.getHttpServer())
        .put('/api/auth/me/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', pngBuffer, {
          filename: 'avatar-2.png',
          contentType: 'image/png',
        })
        .expect(200);

      expect(secondUpload.body.data.avatarUrl).not.toBe(
        firstUpload.body.data.avatarUrl,
      );

      const profile = await prisma.userProfile.findUnique({
        where: { userId },
        select: { avatarUrl: true, avatarStorageKey: true },
      });

      expect(profile?.avatarUrl).toBe(secondUpload.body.data.avatarUrl);
      expect(profile?.avatarStorageKey).toContain('avatars/');
    });

    it('should reject invalid file type', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/auth/me/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from('not-an-image'), {
          filename: 'avatar.txt',
          contentType: 'text/plain',
        })
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return avatar in the profile response', async () => {
      const uploadRes = await request(app.getHttpServer())
        .put('/api/auth/me/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', pngBuffer, {
          filename: 'me-avatar.png',
          contentType: 'image/png',
        })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.workspace).toMatchObject({
        id: workspaceId,
      });
      expect(res.body.data.membership).toMatchObject({
        id: membershipId,
        role: WorkspaceRole.ADMIN,
      });
      expect(res.body.data.avatarUrl).toBe(uploadRes.body.data.avatarUrl);
      expect(res.body.data).not.toHaveProperty('plan');
    });
  });

  describe('DELETE /api/auth/me/avatar', () => {
    it('should remove avatar and return 204', async () => {
      const uploadRes = await request(app.getHttpServer())
        .put('/api/auth/me/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', pngBuffer, {
          filename: 'delete-me.png',
          contentType: 'image/png',
        })
        .expect(200);

      await request(app.getHttpServer())
        .delete('/api/auth/me/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      const profile = await prisma.userProfile.findUnique({
        where: { userId },
        select: { avatarUrl: true, avatarStorageKey: true },
      });

      expect(profile?.avatarUrl).toBeNull();
      expect(profile?.avatarStorageKey).toBeNull();
    });

    it('should be idempotent when user has no avatar', async () => {
      await request(app.getHttpServer())
        .delete('/api/auth/me/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });

    it('should make /auth/me return no avatar after deletion', async () => {
      await request(app.getHttpServer())
        .put('/api/auth/me/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', pngBuffer, {
          filename: 'delete-and-read.png',
          contentType: 'image/png',
        })
        .expect(200);

      await request(app.getHttpServer())
        .delete('/api/auth/me/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      const meRes = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.avatarUrl).toBeUndefined();
    });
  });
});
