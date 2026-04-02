import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { ApiResponse } from '@common/interfaces/api-response.interface';
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
} from '@/generated/prisma/client';
import { AuthBootstrapResponseDto } from '@/modules/auth/dtos/auth-bootstrap-response.dto';
import {
  JwtPayload,
  LoginResponseDto,
  RegisterResponseDto,
  TokensResponseDto,
  VerifyEmailResponseDto,
} from '@/modules/auth/dtos/auth-response.dto';

function getSuccessBody<T>(response: request.Response): ApiResponse<T> {
  return response.body as ApiResponse<T>;
}

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
    const responseBody = getSuccessBody<RegisterResponseDto>(response);

    await waitForMailMockCall('sendTemplate', 1);

    expect(responseBody.success).toBe(true);
    expect(responseBody.data.user).toMatchObject({
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
    expect(responseBody.data.user).not.toHaveProperty('plan');

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
    expect(persistedUser.memberships[0].workspace.name).toBe(
      'Workspace Owner Workspace',
    );
    expect(persistedUser.memberships[0].workspace.subscription).toBeNull();

    const firstMailCall = mailProviderMock.sendTemplate.mock.calls[0]?.[0] as
      | { variables?: Record<string, unknown> }
      | undefined;

    const firstOtpCode = firstMailCall?.variables?.['otpCode'];

    expect(typeof firstOtpCode).toBe('string');
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
    const verifyResponseBody =
      getSuccessBody<VerifyEmailResponseDto>(verifyResponse);

    await waitForMailMockCall('sendTemplate', initialMailCalls + 2);

    expect(verifyResponseBody.success).toBe(true);
    expect(verifyResponseBody.data.user).toMatchObject({
      email: payload.email.toLowerCase(),
      status: UserStatus.ACTIVE,
      workspace: {
        type: WorkspaceType.PERSONAL,
      },
      membership: {
        role: WorkspaceRole.ADMIN,
      },
    });
    expect(verifyResponseBody.data.user).not.toHaveProperty('plan');
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
    const loginResponseBody = getSuccessBody<LoginResponseDto>(loginResponse);

    expect(loginResponseBody.success).toBe(true);
    expect(loginResponseBody.data.user.workspace.id).toBe(
      createdUser.memberships[0].workspaceId,
    );
    expect(loginResponseBody.data.user.membership.id).toBe(
      createdUser.memberships[0].id,
    );
    expect(loginResponseBody.data.user).not.toHaveProperty('plan');

    const accessPayload = await jwtService.verifyAsync<JwtPayload>(
      loginResponseBody.data.tokens.accessToken,
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
        `Bearer ${loginResponseBody.data.tokens.accessToken}`,
      )
      .expect(200);
    const meResponseBody = getSuccessBody<AuthBootstrapResponseDto>(meResponse);

    expect(meResponseBody.success).toBe(true);
    expect(meResponseBody.data).toMatchObject({
      user: {
        id: createdUser.id,
      },
      workspace: {
        id: createdUser.memberships[0].workspaceId,
      },
      membership: {
        id: createdUser.memberships[0].id,
        role: WorkspaceRole.ADMIN,
      },
      profile: {
        countryCode: null,
        theme: null,
        onboardingCompletedAt: null,
      },
      workspaceSettings: {
        baseCurrencyCode: 'USD',
        contentLocale: 'en-US',
        financialTimezone: 'UTC',
      },
      needsOnboarding: true,
    });
    expect(meResponseBody.data.user).not.toHaveProperty('plan');
    expect(meResponseBody.data.profile).not.toHaveProperty('phone');
    expect(meResponseBody.data).not.toHaveProperty('workspaceUserPreference');

    const refreshCookies = loginResponse.headers['set-cookie'];

    expect(refreshCookies).toEqual(
      expect.arrayContaining([expect.stringContaining('refreshToken=')]),
    );

    const refreshResponse = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookies)
      .expect(200);
    const refreshResponseBody =
      getSuccessBody<TokensResponseDto>(refreshResponse);

    expect(refreshResponseBody.success).toBe(true);

    const refreshedPayload = await jwtService.verifyAsync<JwtPayload>(
      refreshResponseBody.data.accessToken,
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
      .set('Authorization', `Bearer ${refreshResponseBody.data.accessToken}`)
      .send({ refreshToken: refreshResponseBody.data.refreshToken })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: refreshResponseBody.data.refreshToken })
      .expect(401);
  });
});
