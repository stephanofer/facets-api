import { INestApplication } from '@nestjs/common';
import { ApiResponse } from '@common/interfaces/api-response.interface';
import { PrismaService } from '@database/prisma.service';
import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  cleanupTestUser,
  createTestApp,
  createTestUser,
} from './helpers/test-app.helper';
import { AuthBootstrapResponseDto } from '@/modules/auth/dtos/auth-bootstrap-response.dto';
import { MeOnboardingResponseDto } from '@/modules/me/dtos/onboarding-response.dto';
import { MeProfileResponseDto } from '@/modules/me/dtos/profile-response.dto';
import { ThemePreference } from '@/generated/prisma/client';

function getSuccessBody<T>(response: request.Response): ApiResponse<T> {
  return response.body as ApiResponse<T>;
}

describe('Me (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const cleanupUserIds = new Set<string>();

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  }, 30000);

  afterAll(async () => {
    for (const userId of cleanupUserIds) {
      await cleanupTestUser(app, userId);
    }

    await app.close();
  });

  it('returns stable empty profile and onboarding resources when no UserProfile exists', async () => {
    const user = await createTestUser(app, {
      email: `me-empty-${Date.now()}@test.com`,
    });
    cleanupUserIds.add(user.userId);

    const profileResponse = await request(app.getHttpServer())
      .get('/api/me/profile')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    const profileResponseBody =
      getSuccessBody<MeProfileResponseDto>(profileResponse);

    expect(profileResponseBody.success).toBe(true);
    expect(profileResponseBody.data).toEqual({
      phone: null,
      countryCode: null,
      theme: null,
      onboardingCompletedAt: null,
    });

    const onboardingResponse = await request(app.getHttpServer())
      .get('/api/me/onboarding')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    const onboardingResponseBody =
      getSuccessBody<MeOnboardingResponseDto>(onboardingResponse);

    expect(onboardingResponseBody.success).toBe(true);
    expect(onboardingResponseBody.data).toEqual({
      onboardingCompletedAt: null,
      needsOnboarding: true,
    });
  });

  it('updates the user-scoped profile with valid phone, country, and theme', async () => {
    const user = await createTestUser(app, {
      email: `me-profile-${Date.now()}@test.com`,
    });
    cleanupUserIds.add(user.userId);

    const payload = {
      phone: '+5491155557777',
      countryCode: 'ar',
      theme: ThemePreference.DARK,
    };

    const patchResponse = await request(app.getHttpServer())
      .patch('/api/me/profile')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send(payload)
      .expect(200);
    const patchResponseBody =
      getSuccessBody<MeProfileResponseDto>(patchResponse);

    expect(patchResponseBody.success).toBe(true);
    expect(patchResponseBody.data).toEqual({
      phone: '+5491155557777',
      countryCode: 'AR',
      theme: ThemePreference.DARK,
      onboardingCompletedAt: null,
    });

    const persistedProfile = await prisma.userProfile.findUniqueOrThrow({
      where: { userId: user.userId },
    });
    expect(persistedProfile.phone).toBe('+5491155557777');
    expect(persistedProfile.countryCode).toBe('AR');
    expect(persistedProfile.theme).toBe(ThemePreference.DARK);

    const getResponse = await request(app.getHttpServer())
      .get('/api/me/profile')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    const getResponseBody = getSuccessBody<MeProfileResponseDto>(getResponse);

    expect(getResponseBody.data).toEqual({
      phone: '+5491155557777',
      countryCode: 'AR',
      theme: ThemePreference.DARK,
      onboardingCompletedAt: null,
    });
  });

  it('rejects invalid profile phone numbers', async () => {
    const user = await createTestUser(app, {
      email: `me-invalid-phone-${Date.now()}@test.com`,
    });
    cleanupUserIds.add(user.userId);

    await request(app.getHttpServer())
      .patch('/api/me/profile')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ phone: '1155557777' })
      .expect(400);
  });

  it('rejects inactive countries in profile updates', async () => {
    const user = await createTestUser(app, {
      email: `me-invalid-country-${Date.now()}@test.com`,
    });
    cleanupUserIds.add(user.userId);

    await request(app.getHttpServer())
      .patch('/api/me/profile')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ countryCode: 'BR' })
      .expect(400);
  });

  it('completes onboarding and propagates needsOnboarding=false to auth bootstrap', async () => {
    const user = await createTestUser(app, {
      email: `me-onboarding-${Date.now()}@test.com`,
    });
    cleanupUserIds.add(user.userId);

    await prisma.userProfile.create({
      data: {
        userId: user.userId,
        countryCode: 'AR',
        theme: ThemePreference.SYSTEM,
      },
    });

    const onboardingResponse = await request(app.getHttpServer())
      .patch('/api/me/onboarding')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ completed: true })
      .expect(200);
    const onboardingResponseBody =
      getSuccessBody<MeOnboardingResponseDto>(onboardingResponse);

    expect(onboardingResponseBody.success).toBe(true);
    expect(onboardingResponseBody.data).toMatchObject({
      needsOnboarding: false,
    });
    expect(onboardingResponseBody.data.onboardingCompletedAt).toEqual(
      expect.any(String),
    );
    expect(onboardingResponseBody.data).not.toHaveProperty('countryCode');

    const bootstrapResponse = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    const bootstrapResponseBody =
      getSuccessBody<AuthBootstrapResponseDto>(bootstrapResponse);

    expect(bootstrapResponseBody.data.needsOnboarding).toBe(false);
    expect(bootstrapResponseBody.data.profile.countryCode).toBe('AR');
    expect(bootstrapResponseBody.data.profile.theme).toBe(
      ThemePreference.SYSTEM,
    );
    expect(bootstrapResponseBody.data.profile.onboardingCompletedAt).toEqual(
      expect.any(String),
    );
    expect(bootstrapResponseBody.data.profile).not.toHaveProperty('phone');
    expect(bootstrapResponseBody.data).not.toHaveProperty(
      'workspaceUserPreference',
    );
  });

  it('rejects onboarding payloads that try to mutate profile-owned fields', async () => {
    const user = await createTestUser(app, {
      email: `me-onboarding-owned-${Date.now()}@test.com`,
    });
    cleanupUserIds.add(user.userId);

    await request(app.getHttpServer())
      .patch('/api/me/onboarding')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ theme: ThemePreference.DARK })
      .expect(400);
  });

  it('rejects onboarding payloads that try to mutate country ownership', async () => {
    const user = await createTestUser(app, {
      email: `me-onboarding-country-${Date.now()}@test.com`,
    });
    cleanupUserIds.add(user.userId);

    await request(app.getHttpServer())
      .patch('/api/me/onboarding')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ countryCode: 'AR' })
      .expect(400);
  });
});
