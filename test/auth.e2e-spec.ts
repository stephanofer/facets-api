import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { ConfigService } from '@config/config.service';
import { PrismaService } from '@database/prisma.service';
import { createUserFixture } from './fixtures/user.fixture';
import {
  cleanupTestUser,
  createTestApp,
  getMailProviderMock,
  waitForMailMockCall,
} from './helpers/test-app.helper';
import {
  PlatformRole,
  UserStatus,
  WorkspaceMembershipStatus,
  WorkspaceRole,
  WorkspaceType,
} from '../src/generated/prisma/client';
import { JwtPayload } from '../src/modules/auth/dtos/auth-response.dto';

describe('Auth workspace-first flows (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const cleanupUserIds = new Set<string>();

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    configService = app.get(ConfigService);
  }, 30000);

  afterAll(async () => {
    for (const userId of cleanupUserIds) {
      await cleanupTestUser(app, userId);
    }

    await app.close();
  });

  it('registers a user with workspace bootstrap and returns workspace-aware identity context', async () => {
    const mailProviderMock = getMailProviderMock();
    const payload = createUserFixture({
      email: `auth-register-${Date.now()}@test.com`,
      firstName: 'Workspace',
      lastName: 'Owner',
    });

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(payload)
      .expect(201);

    await waitForMailMockCall('sendTemplate', 1);

    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toMatchObject({
      email: payload.email.toLowerCase(),
      status: UserStatus.PENDING_VERIFICATION,
      platformRole: PlatformRole.USER,
      workspace: {
        type: WorkspaceType.PERSONAL,
      },
      membership: {
        role: WorkspaceRole.ADMIN,
        status: WorkspaceMembershipStatus.ACTIVE,
      },
    });
    expect(response.body.data.user).not.toHaveProperty('plan');

    const persistedUser = await prisma.user.findUniqueOrThrow({
      where: { email: payload.email.toLowerCase() },
      include: {
        memberships: {
          include: {
            workspace: { include: { settings: true, subscription: true } },
          },
        },
      },
    });
    cleanupUserIds.add(persistedUser.id);

    expect(persistedUser.platformRole).toBe(PlatformRole.USER);
    expect(persistedUser.memberships).toHaveLength(1);
    expect(persistedUser.memberships[0]).toMatchObject({
      role: WorkspaceRole.ADMIN,
      status: WorkspaceMembershipStatus.ACTIVE,
    });
    expect(persistedUser.memberships[0].workspace.type).toBe(
      WorkspaceType.PERSONAL,
    );
    expect(persistedUser.memberships[0].workspace.settings).toMatchObject({
      displayLabel: 'Workspace Owner Workspace',
    });
    expect(persistedUser.memberships[0].workspace.subscription).toBeNull();

    expect(mailProviderMock.sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          otpCode: expect.any(String),
        }),
      }),
    );
  });

  it('rejects login for a user without verified workspace access, then verifies, logs in, refreshes, resolves /me, and logs out', async () => {
    const mailProviderMock = getMailProviderMock();
    const initialMailCalls = mailProviderMock.sendTemplate.mock.calls.length;
    const payload = createUserFixture({
      email: `auth-flow-${Date.now()}@test.com`,
      firstName: 'Flow',
      lastName: 'Tester',
    });

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(payload)
      .expect(201);

    await waitForMailMockCall('sendTemplate', initialMailCalls + 1);

    const createdUser = await prisma.user.findUniqueOrThrow({
      where: { email: payload.email.toLowerCase() },
      include: {
        memberships: true,
      },
    });
    cleanupUserIds.add(createdUser.id);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: payload.email, password: payload.password })
      .expect(403);

    const verificationCall =
      mailProviderMock.sendTemplate.mock.calls[initialMailCalls]?.[0];
    const otpCode = verificationCall?.variables?.otpCode;

    expect(typeof otpCode).toBe('string');
    expect(otpCode).toHaveLength(6);

    const verifyResponse = await request(app.getHttpServer())
      .post('/api/auth/verify-email')
      .send({ email: payload.email, code: otpCode })
      .expect(200);

    await waitForMailMockCall('sendTemplate', initialMailCalls + 2);

    expect(verifyResponse.body.success).toBe(true);
    expect(verifyResponse.body.data.user).toMatchObject({
      email: payload.email.toLowerCase(),
      status: UserStatus.ACTIVE,
      workspace: {
        type: WorkspaceType.PERSONAL,
      },
      membership: {
        role: WorkspaceRole.ADMIN,
      },
    });
    expect(verifyResponse.body.data.user).not.toHaveProperty('plan');
    expect(verifyResponse.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('refreshToken='),
        expect.stringContaining('accessToken='),
      ]),
    );

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: payload.email, password: payload.password })
      .expect(200);

    expect(loginResponse.body.success).toBe(true);
    expect(loginResponse.body.data.user.workspace.id).toBe(
      createdUser.memberships[0].workspaceId,
    );
    expect(loginResponse.body.data.user.membership.id).toBe(
      createdUser.memberships[0].id,
    );
    expect(loginResponse.body.data.user).not.toHaveProperty('plan');

    const accessPayload = await jwtService.verifyAsync<JwtPayload>(
      loginResponse.body.data.tokens.accessToken,
      {
        secret: configService.jwt.accessSecret,
      },
    );

    expect(accessPayload).toMatchObject({
      sub: createdUser.id,
      workspaceId: createdUser.memberships[0].workspaceId,
      membershipId: createdUser.memberships[0].id,
      workspaceRole: WorkspaceRole.ADMIN,
      platformRole: PlatformRole.USER,
    });

    const meResponse = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set(
        'Authorization',
        `Bearer ${loginResponse.body.data.tokens.accessToken}`,
      )
      .expect(200);

    expect(meResponse.body.success).toBe(true);
    expect(meResponse.body.data).toMatchObject({
      id: createdUser.id,
      workspace: {
        id: createdUser.memberships[0].workspaceId,
      },
      membership: {
        id: createdUser.memberships[0].id,
        role: WorkspaceRole.ADMIN,
      },
    });
    expect(meResponse.body.data).not.toHaveProperty('plan');

    const refreshCookies = loginResponse.headers['set-cookie'];

    expect(refreshCookies).toEqual(
      expect.arrayContaining([expect.stringContaining('refreshToken=')]),
    );

    const refreshResponse = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookies)
      .expect(200);

    expect(refreshResponse.body.success).toBe(true);

    const refreshedPayload = await jwtService.verifyAsync<JwtPayload>(
      refreshResponse.body.data.accessToken,
      {
        secret: configService.jwt.accessSecret,
      },
    );

    expect(refreshedPayload).toMatchObject({
      sub: createdUser.id,
      workspaceId: createdUser.memberships[0].workspaceId,
      membershipId: createdUser.memberships[0].id,
      workspaceRole: WorkspaceRole.ADMIN,
      platformRole: PlatformRole.USER,
    });

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${refreshResponse.body.data.accessToken}`)
      .send({ refreshToken: refreshResponse.body.data.refreshToken })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: refreshResponse.body.data.refreshToken })
      .expect(401);
  });
});
