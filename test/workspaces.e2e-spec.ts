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
import {
  PreferenceCategory,
  PreferenceDataType,
  WorkspaceRole,
  WorkspaceType,
} from '../src/generated/prisma/client';

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
  let preferenceDefinitionId: string;

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

    const preferenceDefinition = await prisma.preferenceDefinition.create({
      data: {
        category: PreferenceCategory.REGIONAL,
        key: `personal-date-format-${Date.now()}`,
        dataType: PreferenceDataType.STRING,
        defaultValue: 'MM/DD/YYYY',
        label: 'Personal date format',
      },
    });
    preferenceDefinitionId = preferenceDefinition.id;

    await prisma.userPreference.create({
      data: {
        userId: adminUserId,
        preferenceId: preferenceDefinition.id,
        value: 'MM/DD/YYYY',
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.userPreference.deleteMany({
      where: { preferenceId: preferenceDefinitionId },
    });
    await prisma.preferenceDefinition.deleteMany({
      where: { id: preferenceDefinitionId },
    });
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
      baseLanguage: 'en',
      monthStartDay: 1,
    });
  });

  it('lets guests read shared workspace settings', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/workspaces/current/settings')
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.settings.displayLabel).toContain('Workspace');
  });

  it('lets admins update shared workspace settings without mutating personal preferences', async () => {
    const payload = {
      baseCurrencyCode: 'ARS',
      baseLanguage: 'es',
      dateFormat: 'YYYY-MM-DD',
      monthStartDay: 5,
      weekStartDay: 1,
      timezone: 'America/Argentina/Buenos_Aires',
      locale: 'es-AR',
      displayLabel: 'Casa',
      workspaceType: WorkspaceType.FAMILY,
    };

    const res = await request(app.getHttpServer())
      .patch('/api/workspaces/current/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.workspace.type).toBe(WorkspaceType.FAMILY);
    expect(res.body.data.settings).toMatchObject({
      baseCurrencyCode: 'ARS',
      baseLanguage: 'es',
      dateFormat: 'YYYY-MM-DD',
      monthStartDay: 5,
      timezone: 'America/Argentina/Buenos_Aires',
      locale: 'es-AR',
      displayLabel: 'Casa',
    });

    const persistedWorkspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: { settings: true },
    });
    expect(persistedWorkspace.type).toBe(WorkspaceType.FAMILY);
    expect(persistedWorkspace.settings).toMatchObject({
      baseCurrencyCode: 'ARS',
      displayLabel: 'Casa',
    });

    const personalPreference = await prisma.userPreference.findFirstOrThrow({
      where: {
        userId: adminUserId,
        preferenceId: preferenceDefinitionId,
      },
    });
    expect(personalPreference.value).toBe('MM/DD/YYYY');
  });

  it('denies members from updating shared workspace settings', async () => {
    await request(app.getHttpServer())
      .patch('/api/workspaces/current/settings')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ displayLabel: 'Member Hack' })
      .expect(403);
  });

  it('denies guests from updating shared workspace settings', async () => {
    await request(app.getHttpServer())
      .patch('/api/workspaces/current/settings')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ displayLabel: 'Guest Hack' })
      .expect(403);
  });
});
