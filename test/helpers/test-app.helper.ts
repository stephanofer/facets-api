process.env.AI_GATEWAY_ACCOUNT_ID ??= 'test-account-id';
process.env.AI_GATEWAY_ID ??= 'test-gateway-id';
process.env.AI_GATEWAY_API_TOKEN ??= 'test-ai-gateway-token';
process.env.AI_REQUEST_TIMEOUT_MS ??= '30000';
process.env.AI_METADATA_ENVIRONMENT ??= 'test';

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { HttpAdapterHost, APP_GUARD, Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '@/app.module';
import { AllExceptionsFilter } from '@common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from '@common/interceptors/transform-response.interceptor';
import {
  AI_GATEWAY_CLIENT,
  AiGatewayClient,
} from '@ai/interfaces/ai-gateway-client.interface';
import {
  MAIL_PROVIDER,
  MailProvider,
} from '@mail/providers/mail-provider.interface';
import { PrismaService } from '@database/prisma.service';
import { ConfigService } from '@config/config.service';
import { STORAGE_PROVIDER } from '@storage/interfaces/storage-provider.interface';
import {
  PlatformRole,
  UserStatus,
  WorkspaceMembershipStatus,
  WorkspaceRole,
  WorkspaceStatus,
  WorkspaceType,
} from '../../src/generated/prisma/client';

const aiGatewayClientMock: jest.Mocked<AiGatewayClient> = {
  executeChatCompletion: jest.fn(),
};

const mailProviderMock: jest.Mocked<MailProvider> = {
  send: jest.fn(),
  sendTemplate: jest.fn(),
};

export interface TestUserContext {
  userId: string;
  workspaceId: string;
  membershipId: string;
  accessToken: string;
  email: string;
  password: string;
}

const DEFAULT_TEST_PASSWORD = 'TestP@ss123';

export interface TestAppOptions {
  overrideProviders?: Array<{
    provide: string | symbol | Function;
    useValue: unknown;
  }>;
  skipReferenceSeedData?: boolean;
}

export async function createTestApp(
  options: TestAppOptions = {},
): Promise<INestApplication> {
  aiGatewayClientMock.executeChatCompletion.mockReset();
  mailProviderMock.send.mockReset();
  mailProviderMock.sendTemplate.mockReset();

  const testingModuleBuilder = Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(STORAGE_PROVIDER)
    .useValue({
      upload: async () => undefined,
      delete: async () => undefined,
      getPresignedUrl: async (bucket: string, key: string) =>
        `https://cdn.e2e.test/${bucket}/${key}`,
    })
    .overrideProvider(AI_GATEWAY_CLIENT)
    .useValue(aiGatewayClientMock)
    .overrideProvider(MAIL_PROVIDER)
    .useValue(mailProviderMock);

  for (const provider of options.overrideProviders ?? []) {
    testingModuleBuilder
      .overrideProvider(provider.provide)
      .useValue(provider.useValue);
  }

  const moduleFixture: TestingModule = await testingModuleBuilder.compile();

  const app = moduleFixture.createNestApplication();
  const httpAdapterHost = app.get(HttpAdapterHost);
  const reflector = app.get(Reflector);

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/details', method: RequestMethod.GET },
    ],
  });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));
  app.useGlobalInterceptors(new TransformResponseInterceptor(reflector));

  await app.init();

  if (!options.skipReferenceSeedData) {
    await ensureReferenceSeedData(app.get(PrismaService));
  }

  return app;
}

/**
 * Create a fully bootstrapped workspace-aware test user directly in the DB
 * (bypassing the public registration flow). The created fixture includes:
 * - active user
 * - personal workspace
 * - active workspace membership
 * - workspace settings
 * - JWT access token with workspace-aware claims
 */
export async function createTestUser(
  app: INestApplication,
  overrides: {
    email?: string;
    firstName?: string;
    lastName?: string;
    platformRole?: PlatformRole;
    role?: WorkspaceRole;
  } = {},
): Promise<TestUserContext> {
  const prisma = app.get(PrismaService);
  const jwtService = app.get(JwtService);
  const configService = app.get(ConfigService);

  const email = overrides.email ?? `e2e-${Date.now()}@test.com`;
  const argon2 = await import('argon2');
  const hashedPassword = await argon2.hash(DEFAULT_TEST_PASSWORD);

  const workspaceName = `${overrides.firstName ?? 'E2E'} ${overrides.lastName ?? 'TestUser'} Workspace`;

  const result = await prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name: workspaceName,
        type: WorkspaceType.PERSONAL,
        status: WorkspaceStatus.ACTIVE,
      },
    });

    const newUser = await tx.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName: overrides.firstName ?? 'E2E',
        lastName: overrides.lastName ?? 'TestUser',
        status: UserStatus.ACTIVE,
        emailVerified: true,
        platformRole: overrides.platformRole ?? PlatformRole.USER,
      },
    });

    const membership = await tx.workspaceMembership.create({
      data: {
        workspaceId: workspace.id,
        userId: newUser.id,
        role: overrides.role ?? WorkspaceRole.ADMIN,
        status: WorkspaceMembershipStatus.ACTIVE,
      },
    });

    await tx.workspaceSettings.create({
      data: {
        workspaceId: workspace.id,
        displayLabel: workspaceName,
      },
    });

    return {
      user: newUser,
      workspace,
      membership,
    };
  });

  const accessToken = await jwtService.signAsync(
    {
      sub: result.user.id,
      email: result.user.email,
      workspaceId: result.workspace.id,
      membershipId: result.membership.id,
      workspaceRole: result.membership.role,
      platformRole: result.user.platformRole,
    },
    {
      secret: configService.jwt.accessSecret,
      expiresIn: '1h',
    },
  );

  return {
    userId: result.user.id,
    workspaceId: result.workspace.id,
    membershipId: result.membership.id,
    accessToken,
    email: result.user.email,
    password: DEFAULT_TEST_PASSWORD,
  };
}

export async function createWorkspaceMember(
  app: INestApplication,
  workspaceId: string,
  role: WorkspaceRole,
  overrides: {
    email?: string;
    firstName?: string;
    lastName?: string;
  } = {},
): Promise<TestUserContext> {
  const prisma = app.get(PrismaService);
  const jwtService = app.get(JwtService);
  const configService = app.get(ConfigService);

  const email = overrides.email ?? `e2e-member-${Date.now()}@test.com`;
  const argon2 = await import('argon2');
  const hashedPassword = await argon2.hash(DEFAULT_TEST_PASSWORD);

  const result = await prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });

    const user = await tx.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName: overrides.firstName ?? role,
        lastName: overrides.lastName ?? 'Member',
        status: UserStatus.ACTIVE,
        emailVerified: true,
        platformRole: PlatformRole.USER,
      },
    });

    const membership = await tx.workspaceMembership.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role,
        status: WorkspaceMembershipStatus.ACTIVE,
      },
    });

    return {
      user,
      workspace,
      membership,
    };
  });

  const accessToken = await jwtService.signAsync(
    {
      sub: result.user.id,
      email: result.user.email,
      workspaceId: result.workspace.id,
      membershipId: result.membership.id,
      workspaceRole: result.membership.role,
      platformRole: result.user.platformRole,
    },
    {
      secret: configService.jwt.accessSecret,
      expiresIn: '1h',
    },
  );

  return {
    userId: result.user.id,
    workspaceId: result.workspace.id,
    membershipId: result.membership.id,
    accessToken,
    email: result.user.email,
    password: DEFAULT_TEST_PASSWORD,
  };
}

/**
 * Clean up test data created during E2E tests.
 * Deletes the identity plus any orphaned workspace stack created for it.
 */
export async function cleanupTestUser(
  app: INestApplication,
  userId: string,
): Promise<void> {
  const prisma = app.get(PrismaService);
  const memberships = await prisma.workspaceMembership.findMany({
    where: { userId },
    select: { id: true, workspaceId: true },
  });
  const workspaceIds = memberships.map((membership) => membership.workspaceId);

  await prisma.$transaction([
    prisma.userProfile.deleteMany({ where: { userId } }),
    prisma.file.deleteMany({ where: { uploadedByUserId: userId } }),
    prisma.refreshToken.deleteMany({ where: { userId } }),
    prisma.otpCode.deleteMany({ where: { userId } }),
    prisma.workspaceMembership.deleteMany({ where: { userId } }),
    prisma.user.deleteMany({ where: { id: userId } }),
  ]);

  for (const workspaceId of workspaceIds) {
    const remainingMemberships = await prisma.workspaceMembership.count({
      where: { workspaceId },
    });

    if (remainingMemberships > 0) {
      continue;
    }

    await prisma.$transaction([
      prisma.usageRecord.deleteMany({ where: { workspaceId } }),
      prisma.usageEvent.deleteMany({ where: { workspaceId } }),
      prisma.planChangeLog.deleteMany({ where: { workspaceId } }),
      prisma.subscription.deleteMany({ where: { workspaceId } }),
      prisma.workspaceSettings.deleteMany({ where: { workspaceId } }),
      prisma.workspace.deleteMany({ where: { id: workspaceId } }),
    ]);
  }
}

export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  // Add table cleaning logic as models are added
  // Example: await prisma.$executeRaw`TRUNCATE users CASCADE`;
}

async function ensureReferenceSeedData(prisma: PrismaService): Promise<void> {
  for (const currency of [
    { code: 'USD', name: 'US Dollar', symbol: '$', decimalScale: 2 },
    { code: 'ARS', name: 'Argentine Peso', symbol: '$', decimalScale: 2 },
  ]) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: {
        name: currency.name,
        symbol: currency.symbol,
        decimalScale: currency.decimalScale,
        isActive: true,
      },
      create: {
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        decimalScale: currency.decimalScale,
        isActive: true,
      },
    });
  }
}

export function getAiGatewayClientMock(): jest.Mocked<AiGatewayClient> {
  return aiGatewayClientMock;
}

export function getMailProviderMock(): jest.Mocked<MailProvider> {
  return mailProviderMock;
}

export async function waitForMailMockCall(
  method: 'send' | 'sendTemplate',
  expectedCalls: number,
  timeoutMs = 5000,
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (mailProviderMock[method].mock.calls.length >= expectedCalls) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(
    `Timed out waiting for mail mock method ${method} to reach ${expectedCalls} call(s)`,
  );
}
