import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '@common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from '@common/interceptors/transform-response.interceptor';
import { PrismaService } from '@database/prisma.service';
import { ConfigService } from '@config/config.service';

/**
 * No-op throttler guard for E2E tests.
 * Disables rate limiting so tests can run without delays.
 */
class NoopThrottlerGuard {
  canActivate(): boolean {
    return true;
  }
}

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ThrottlerGuard)
    .useClass(NoopThrottlerGuard)
    .compile();

  const app = moduleFixture.createNestApplication();
  const httpAdapterHost = app.get(HttpAdapterHost);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  await app.init();

  return app;
}

/**
 * Create a test user directly in the DB (bypassing registration flow)
 * Returns the user record + a valid JWT access token.
 */
export async function createTestUser(
  app: INestApplication,
  overrides: {
    email?: string;
    firstName?: string;
    lastName?: string;
  } = {},
): Promise<{ userId: string; accessToken: string }> {
  const prisma = app.get(PrismaService);
  const jwtService = app.get(JwtService);
  const configService = app.get(ConfigService);

  const email = overrides.email ?? `e2e-${Date.now()}@test.com`;
  const argon2 = await import('argon2');
  const hashedPassword = await argon2.hash('TestP@ss123');

  // Create user + subscription in a transaction
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName: overrides.firstName ?? 'E2E',
        lastName: overrides.lastName ?? 'TestUser',
        status: 'ACTIVE',
        emailVerified: true,
      },
    });

    // Assign free plan
    const freePlan = await tx.plan.findFirst({
      where: { isDefault: true, isActive: true },
    });

    if (freePlan) {
      await tx.subscription.create({
        data: {
          userId: newUser.id,
          planId: freePlan.id,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: null,
        },
      });
    }

    return newUser;
  });

  // Sign a valid JWT
  const accessToken = await jwtService.signAsync(
    { sub: user.id, email: user.email },
    {
      secret: configService.jwt.accessSecret,
      expiresIn: '1h',
    },
  );

  return { userId: user.id, accessToken };
}

/**
 * Clean up test data created during E2E tests.
 * Deletes everything associated with a test user.
 */
export async function cleanupTestUser(
  app: INestApplication,
  userId: string,
): Promise<void> {
  const prisma = app.get(PrismaService);

  // Delete in dependency order
  await prisma.$transaction([
    prisma.account.deleteMany({ where: { userId } }),
    prisma.category.deleteMany({ where: { userId, isSystem: false } }),
    prisma.usageRecord.deleteMany({ where: { userId } }),
    prisma.refreshToken.deleteMany({ where: { userId } }),
    prisma.otpCode.deleteMany({ where: { userId } }),
    prisma.subscription.deleteMany({ where: { userId } }),
    prisma.user.deleteMany({ where: { id: userId } }),
  ]);
}

export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  // Add table cleaning logic as models are added
  // Example: await prisma.$executeRaw`TRUNCATE users CASCADE`;
}
