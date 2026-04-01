import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  cleanupTestUser,
  createTestApp,
  createTestUser,
  createWorkspaceMember,
} from './helpers/test-app.helper';
import { WorkspaceRole, WorkspaceType } from '@/generated/prisma/client';

describe('Workspaces (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminUserId: string;
  let workspaceId: string;
  let adminToken: string;
  let memberUserId: string;
  let memberToken: string;
  let guestUserId: string;
  let guestToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const adminUser = await createTestUser(app);
    adminUserId = adminUser.userId;
    workspaceId = adminUser.workspaceId;
    adminToken = adminUser.accessToken;

    const memberUser = await createWorkspaceMember(
      app,
      workspaceId,
      WorkspaceRole.MEMBER,
      {
        email: `e2e-workspace-member-${Date.now()}@test.com`,
      },
    );
    memberUserId = memberUser.userId;
    memberToken = memberUser.accessToken;

    const guestUser = await createWorkspaceMember(
      app,
      workspaceId,
      WorkspaceRole.GUEST,
      {
        email: `e2e-workspace-guest-${Date.now()}@test.com`,
      },
    );
    guestUserId = guestUser.userId;
    guestToken = guestUser.accessToken;
  }, 30000);

  afterAll(async () => {
    await cleanupTestUser(app, memberUserId);
    await cleanupTestUser(app, guestUserId);
    await cleanupTestUser(app, adminUserId);
    await app.close();
  });

  it('returns the current workspace summary and shared settings', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/workspaces/current')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.workspace).toMatchObject({
      id: workspaceId,
      type: WorkspaceType.PERSONAL,
    });
    expect(res.body.data.membership.role).toBe(WorkspaceRole.ADMIN);
    expect(res.body.data.settings).toMatchObject({
      baseCurrencyCode: 'USD',
      contentLocale: 'en-US',
      financialTimezone: 'UTC',
      monthStartDay: 1,
    });
  });

  it('lets guests read shared workspace settings', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/workspaces/current/settings')
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.settings.baseCurrencyCode).toBe('USD');
  });

  it('lets admins update workspace identity separately from shared settings', async () => {
    const payload = {
      name: 'Casa',
    };

    const res = await request(app.getHttpServer())
      .patch('/api/workspaces/current')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.workspace).toMatchObject({
      name: 'Casa',
      type: WorkspaceType.PERSONAL,
    });

    const persistedWorkspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });
    expect(persistedWorkspace.name).toBe('Casa');
  });

  it('lets admins update shared workspace settings without mutating workspace identity', async () => {
    const payload = {
      baseCurrencyCode: 'ARS',
      contentLocale: 'es-AR',
      dateFormat: 'YYYY-MM-DD',
      monthStartDay: 5,
      weekStartDay: 1,
      financialTimezone: 'America/Argentina/Buenos_Aires',
    };

    const res = await request(app.getHttpServer())
      .patch('/api/workspaces/current/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.workspace.type).toBe(WorkspaceType.PERSONAL);
    expect(res.body.data.workspace.name).toBe('Casa');
    expect(res.body.data.settings).toMatchObject({
      baseCurrencyCode: 'ARS',
      contentLocale: 'es-AR',
      dateFormat: 'YYYY-MM-DD',
      monthStartDay: 5,
      financialTimezone: 'America/Argentina/Buenos_Aires',
    });

    const persistedWorkspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: { settings: true },
    });
    expect(persistedWorkspace.type).toBe(WorkspaceType.PERSONAL);
    expect(persistedWorkspace.name).toBe('Casa');
    expect(persistedWorkspace.settings).toMatchObject({
      baseCurrencyCode: 'ARS',
      contentLocale: 'es-AR',
      financialTimezone: 'America/Argentina/Buenos_Aires',
    });
  });

  it('denies members from updating workspace identity', async () => {
    await request(app.getHttpServer())
      .patch('/api/workspaces/current')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Member Hack' })
      .expect(403);
  });

  it('denies guests from updating workspace identity', async () => {
    await request(app.getHttpServer())
      .patch('/api/workspaces/current')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ name: 'Guest Hack' })
      .expect(403);
  });

  it('denies members from updating shared workspace settings', async () => {
    await request(app.getHttpServer())
      .patch('/api/workspaces/current/settings')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ baseCurrencyCode: 'EUR' })
      .expect(403);
  });

  it('denies guests from updating shared workspace settings', async () => {
    await request(app.getHttpServer())
      .patch('/api/workspaces/current/settings')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ baseCurrencyCode: 'EUR' })
      .expect(403);
  });
});
