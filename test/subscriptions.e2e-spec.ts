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
import { LimitPeriod, WorkspaceRole } from '../src/generated/prisma/client';

describe('Subscriptions (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let adminWorkspaceAUserId!: string;
  let adminWorkspaceAToken!: string;
  let workspaceAId!: string;

  let memberWorkspaceAUserId!: string;
  let memberWorkspaceAToken!: string;

  let guestWorkspaceAUserId!: string;
  let guestWorkspaceAToken!: string;

  let adminWorkspaceBUserId!: string;
  let adminWorkspaceBToken!: string;
  let workspaceBId!: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const workspaceAAdmin = await createTestUser(app, {
      email: `e2e-subscriptions-admin-a-${Date.now()}@test.com`,
      firstName: 'Workspace',
      lastName: 'Alpha',
    });
    adminWorkspaceAUserId = workspaceAAdmin.userId;
    adminWorkspaceAToken = workspaceAAdmin.accessToken;
    workspaceAId = workspaceAAdmin.workspaceId;

    const workspaceAMember = await createWorkspaceMember(
      app,
      workspaceAId,
      WorkspaceRole.MEMBER,
      {
        email: `e2e-subscriptions-member-${Date.now()}@test.com`,
      },
    );
    memberWorkspaceAUserId = workspaceAMember.userId;
    memberWorkspaceAToken = workspaceAMember.accessToken;

    const workspaceAGuest = await createWorkspaceMember(
      app,
      workspaceAId,
      WorkspaceRole.GUEST,
      {
        email: `e2e-subscriptions-guest-${Date.now()}@test.com`,
      },
    );
    guestWorkspaceAUserId = workspaceAGuest.userId;
    guestWorkspaceAToken = workspaceAGuest.accessToken;

    const workspaceBAdmin = await createTestUser(app, {
      email: `e2e-subscriptions-admin-b-${Date.now()}@test.com`,
      firstName: 'Workspace',
      lastName: 'Beta',
    });
    adminWorkspaceBUserId = workspaceBAdmin.userId;
    adminWorkspaceBToken = workspaceBAdmin.accessToken;
    workspaceBId = workspaceBAdmin.workspaceId;

    await seedMonthlyUsage(workspaceAId, 7);
    await seedMonthlyUsage(workspaceBId, 2);
  }, 30000);

  afterAll(async () => {
    await cleanupTestUser(app, memberWorkspaceAUserId);
    await cleanupTestUser(app, guestWorkspaceAUserId);
    await cleanupTestUser(app, adminWorkspaceBUserId);
    await cleanupTestUser(app, adminWorkspaceAUserId);
    await app.close();
  });

  it('isolates workspace subscription and usage data across workspaces', async () => {
    const workspaceABeforeUpgrade = await request(app.getHttpServer())
      .get('/api/subscriptions/current')
      .set('Authorization', `Bearer ${adminWorkspaceAToken}`)
      .expect(200);

    const workspaceBBeforeUpgrade = await request(app.getHttpServer())
      .get('/api/subscriptions/current')
      .set('Authorization', `Bearer ${adminWorkspaceBToken}`)
      .expect(200);

    expect(workspaceABeforeUpgrade.body.success).toBe(true);
    expect(workspaceABeforeUpgrade.body.data.subscription.plan.code).toBe(
      'free',
    );
    expect(workspaceBBeforeUpgrade.body.success).toBe(true);
    expect(workspaceBBeforeUpgrade.body.data.subscription.plan.code).toBe(
      'free',
    );

    const upgradeResponse = await request(app.getHttpServer())
      .post('/api/subscriptions/upgrade')
      .set('Authorization', `Bearer ${adminWorkspaceAToken}`)
      .send({ planCode: 'pro' })
      .expect(200);

    expect(upgradeResponse.body.success).toBe(true);
    expect(upgradeResponse.body.data.subscription.plan.code).toBe('pro');

    const workspaceAAfterUpgrade = await request(app.getHttpServer())
      .get('/api/subscriptions/current')
      .set('Authorization', `Bearer ${adminWorkspaceAToken}`)
      .expect(200);

    const workspaceBAfterUpgrade = await request(app.getHttpServer())
      .get('/api/subscriptions/current')
      .set('Authorization', `Bearer ${adminWorkspaceBToken}`)
      .expect(200);

    expect(workspaceAAfterUpgrade.body.data.subscription.plan.code).toBe('pro');
    expect(workspaceBAfterUpgrade.body.data.subscription.plan.code).toBe(
      'free',
    );

    const workspaceAUsage = await request(app.getHttpServer())
      .get('/api/subscriptions/usage')
      .set('Authorization', `Bearer ${adminWorkspaceAToken}`)
      .expect(200);

    const workspaceBUsage = await request(app.getHttpServer())
      .get('/api/subscriptions/usage')
      .set('Authorization', `Bearer ${adminWorkspaceBToken}`)
      .expect(200);

    const workspaceATransactionsUsage = findFeatureUsage(
      workspaceAUsage.body.data.features,
      'transactions_per_month',
    );
    const workspaceBTransactionsUsage = findFeatureUsage(
      workspaceBUsage.body.data.features,
      'transactions_per_month',
    );

    expect(workspaceAUsage.body.success).toBe(true);
    expect(workspaceAUsage.body.data.planCode).toBe('pro');
    expect(workspaceATransactionsUsage).toMatchObject({
      current: 7,
      limit: 1000,
      limitReached: false,
    });

    expect(workspaceBUsage.body.success).toBe(true);
    expect(workspaceBUsage.body.data.planCode).toBe('free');
    expect(workspaceBTransactionsUsage).toMatchObject({
      current: 2,
      limit: 100,
      limitReached: false,
    });
  });

  async function assertBillingDenied(accessToken: string): Promise<void> {
    await request(app.getHttpServer())
      .get('/api/workspaces/current')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/subscriptions/preview')
      .query({ planCode: 'pro' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/subscriptions/upgrade')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ planCode: 'premium' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/subscriptions/downgrade')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ planCode: 'free' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/subscriptions/cancel')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'not allowed' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/subscriptions/reactivate')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete('/api/subscriptions/scheduled')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/subscriptions/history')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  }

  it('denies member billing and plan management operations', async () => {
    await assertBillingDenied(memberWorkspaceAToken);
  });

  it('denies guest billing and plan management operations', async () => {
    await assertBillingDenied(guestWorkspaceAToken);
  });

  it('allows workspace admins to manage billing and keeps plan history scoped to their workspace', async () => {
    const previewResponse = await request(app.getHttpServer())
      .get('/api/subscriptions/preview')
      .query({ planCode: 'free' })
      .set('Authorization', `Bearer ${adminWorkspaceAToken}`)
      .expect(200);

    expect(previewResponse.body.success).toBe(true);
    expect(previewResponse.body.data.preview).toMatchObject({
      changeType: 'DOWNGRADE',
      currentPlan: { code: 'pro' },
      targetPlan: { code: 'free' },
    });

    const workspaceAHistory = await request(app.getHttpServer())
      .get('/api/subscriptions/history')
      .set('Authorization', `Bearer ${adminWorkspaceAToken}`)
      .expect(200);

    const workspaceBHistory = await request(app.getHttpServer())
      .get('/api/subscriptions/history')
      .set('Authorization', `Bearer ${adminWorkspaceBToken}`)
      .expect(200);

    expect(workspaceAHistory.body.success).toBe(true);
    expect(workspaceAHistory.body.data.history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          changeType: 'UPGRADE',
          toPlanCode: 'pro',
        }),
      ]),
    );
    expect(workspaceBHistory.body.success).toBe(true);
    expect(workspaceBHistory.body.data.history).toEqual([]);

    const workspaceALogs = await prisma.planChangeLog.findMany({
      where: { workspaceId: workspaceAId },
      orderBy: { requestedAt: 'desc' },
    });
    const workspaceBLogs = await prisma.planChangeLog.findMany({
      where: { workspaceId: workspaceBId },
    });

    expect(workspaceALogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workspaceId: workspaceAId,
          requestedByUserId: adminWorkspaceAUserId,
        }),
      ]),
    );
    expect(workspaceBLogs).toEqual([]);
  });

  async function seedMonthlyUsage(
    workspaceId: string,
    count: number,
  ): Promise<void> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    await prisma.usageRecord.upsert({
      where: {
        workspaceId_featureCode_periodStart: {
          workspaceId,
          featureCode: 'transactions_per_month',
          periodStart,
        },
      },
      update: {
        count,
        periodType: LimitPeriod.MONTHLY,
        periodEnd,
      },
      create: {
        workspaceId,
        featureCode: 'transactions_per_month',
        periodType: LimitPeriod.MONTHLY,
        periodStart,
        periodEnd,
        count,
      },
    });
  }

  function findFeatureUsage(
    features: Array<{
      featureCode: string;
      current: number;
      limit: number;
      limitReached: boolean;
    }>,
    featureCode: string,
  ): {
    featureCode: string;
    current: number;
    limit: number;
    limitReached: boolean;
  } {
    const feature = features.find((item) => item.featureCode === featureCode);

    expect(feature).toBeDefined();

    return feature!;
  }
});
