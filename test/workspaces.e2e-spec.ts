import { INestApplication } from '@nestjs/common';
import { ApiResponse } from '@common/interfaces/api-response.interface';
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
  CurrentWorkspaceResponseDto,
  WorkspaceDirectoryItemDto,
  WorkspaceSettingsResponseDto,
} from '@/modules/workspaces/dtos/workspace-response.dto';
import { WorkspacePreferencesResponseDto } from '@/modules/workspaces/dtos/workspace-preferences-response.dto';
import { WorkspaceRole, WorkspaceType } from '@/generated/prisma/client';

function getSuccessBody<T>(response: request.Response): ApiResponse<T> {
  return response.body as ApiResponse<T>;
}

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
  let secondaryWorkspaceId: string;

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
    if (secondaryWorkspaceId) {
      await prisma.workspace.deleteMany({
        where: { id: secondaryWorkspaceId },
      });
    }
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
    const responseBody = getSuccessBody<CurrentWorkspaceResponseDto>(res);

    expect(responseBody.success).toBe(true);
    expect(responseBody.data.workspace).toMatchObject({
      id: workspaceId,
      type: WorkspaceType.PERSONAL,
    });
    expect(responseBody.data.membership.role).toBe(WorkspaceRole.ADMIN);
    expect(responseBody.data.settings).toMatchObject({
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
    const responseBody = getSuccessBody<WorkspaceSettingsResponseDto>(res);

    expect(responseBody.success).toBe(true);
    expect(responseBody.data.settings.baseCurrencyCode).toBe('USD');
  });

  it('lists only membership-scoped workspaces and marks the current one', async () => {
    const secondaryWorkspace = await prisma.workspace.create({
      data: {
        name: 'Shared Team',
        type: WorkspaceType.GROUP,
      },
    });
    secondaryWorkspaceId = secondaryWorkspace.id;

    await prisma.workspaceSettings.create({
      data: {
        workspaceId: secondaryWorkspace.id,
      },
    });

    await prisma.workspaceMembership.create({
      data: {
        workspaceId: secondaryWorkspace.id,
        userId: adminUserId,
        role: WorkspaceRole.MEMBER,
      },
    });

    const res = await request(app.getHttpServer())
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const responseBody = getSuccessBody<WorkspaceDirectoryItemDto[]>(res);
    const currentWorkspace = responseBody.data.find(
      (item) => item.workspace.id === workspaceId,
    );
    const secondaryWorkspaceItem = responseBody.data.find(
      (item) => item.workspace.id === secondaryWorkspace.id,
    );

    expect(responseBody.success).toBe(true);
    expect(currentWorkspace).toBeDefined();
    expect(currentWorkspace?.isCurrent).toBe(true);
    expect(currentWorkspace?.workspace.type).toBe(WorkspaceType.PERSONAL);
    expect(currentWorkspace?.membership.role).toBe(WorkspaceRole.ADMIN);
    expect(secondaryWorkspaceItem).toBeDefined();
    expect(secondaryWorkspaceItem?.isCurrent).toBe(false);
    expect(secondaryWorkspaceItem?.workspace.type).toBe(WorkspaceType.GROUP);
    expect(secondaryWorkspaceItem?.membership.role).toBe(WorkspaceRole.MEMBER);
    expect(responseBody.data).toHaveLength(2);
  });

  it('returns a stable current workspace preference resource for the authenticated member', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/workspaces/current/preferences')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const responseBody = getSuccessBody<WorkspacePreferencesResponseDto>(res);

    expect(responseBody.success).toBe(true);
    expect(responseBody.data).toEqual({
      uiLocale: null,
      dateFormat: null,
      dashboardPreferences: {},
      reportPreferences: {},
      transactionPreferences: {},
    });
  });

  it('updates only the current user preference row for the current workspace', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/workspaces/current/preferences')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        uiLocale: 'es-AR',
        dateFormat: 'YYYY-MM-DD',
        dashboardPreferences: { compact: true },
        reportPreferences: { defaultPeriod: 'month' },
        transactionPreferences: { showPending: true },
      })
      .expect(200);
    const responseBody = getSuccessBody<WorkspacePreferencesResponseDto>(res);

    expect(responseBody.success).toBe(true);
    expect(responseBody.data).toEqual({
      uiLocale: 'es-AR',
      dateFormat: 'YYYY-MM-DD',
      dashboardPreferences: { compact: true },
      reportPreferences: { defaultPeriod: 'month' },
      transactionPreferences: { showPending: true },
    });

    const adminPreference =
      await prisma.workspaceUserPreference.findUniqueOrThrow({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: adminUserId,
          },
        },
      });

    expect(adminPreference).toMatchObject({
      uiLocale: 'es-AR',
      dateFormat: 'YYYY-MM-DD',
      dashboardPreferences: { compact: true },
      reportPreferences: { defaultPeriod: 'month' },
      transactionPreferences: { showPending: true },
    });

    const memberPreference = await prisma.workspaceUserPreference.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: memberUserId,
        },
      },
    });

    expect(memberPreference).toBeNull();
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
    const responseBody = getSuccessBody<CurrentWorkspaceResponseDto>(res);

    expect(responseBody.success).toBe(true);
    expect(responseBody.data.workspace).toMatchObject({
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
    const responseBody = getSuccessBody<CurrentWorkspaceResponseDto>(res);

    expect(responseBody.success).toBe(true);
    expect(responseBody.data.workspace.type).toBe(WorkspaceType.PERSONAL);
    expect(responseBody.data.workspace.name).toBe('Casa');
    expect(responseBody.data.settings).toMatchObject({
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
