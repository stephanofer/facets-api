process.env.AI_GATEWAY_ACCOUNT_ID ??= 'test-account-id';
process.env.AI_GATEWAY_ID ??= 'test-gateway-id';
process.env.AI_GATEWAY_API_TOKEN ??= 'test-ai-gateway-token';
process.env.AI_REQUEST_TIMEOUT_MS ??= '30000';
process.env.AI_METADATA_ENVIRONMENT ??= 'test';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
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
import { SYSTEM_CATEGORIES } from '@modules/categories/system-categories.data';
import {
  FeatureLimitType,
  FeatureType,
  LimitPeriod,
  PlatformRole,
  SubscriptionStatus,
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

interface TestPlanSeed {
  code: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number | null;
  isDefault: boolean;
  sortOrder: number;
}

interface TestFeatureSeed {
  featureCode: string;
  limitType: FeatureLimitType;
  limitValue: number;
  featureType?: FeatureType;
  limitPeriod?: LimitPeriod;
}

const TEST_PLAN_SEEDS: TestPlanSeed[] = [
  {
    code: 'free',
    name: 'Free',
    description: 'Default workspace plan for automated tests',
    priceMonthly: 0,
    priceYearly: null,
    isDefault: true,
    sortOrder: 0,
  },
  {
    code: 'pro',
    name: 'Pro',
    description: 'Pro workspace plan for automated tests',
    priceMonthly: 4.99,
    priceYearly: 49.99,
    isDefault: false,
    sortOrder: 1,
  },
  {
    code: 'premium',
    name: 'Premium',
    description: 'Premium workspace plan for automated tests',
    priceMonthly: 9.99,
    priceYearly: 99.99,
    isDefault: false,
    sortOrder: 2,
  },
];

const TEST_PLAN_FEATURE_SEEDS: Record<string, TestFeatureSeed[]> = {
  free: [
    {
      featureCode: 'accounts',
      limitType: FeatureLimitType.COUNT,
      limitValue: 2,
      featureType: FeatureType.RESOURCE,
    },
    {
      featureCode: 'goals',
      limitType: FeatureLimitType.COUNT,
      limitValue: 1,
      featureType: FeatureType.RESOURCE,
    },
    {
      featureCode: 'debts',
      limitType: FeatureLimitType.COUNT,
      limitValue: 2,
      featureType: FeatureType.RESOURCE,
    },
    {
      featureCode: 'loans',
      limitType: FeatureLimitType.COUNT,
      limitValue: 1,
      featureType: FeatureType.RESOURCE,
    },
    {
      featureCode: 'custom_categories',
      limitType: FeatureLimitType.COUNT,
      limitValue: 5,
      featureType: FeatureType.RESOURCE,
    },
    {
      featureCode: 'recurring_payments',
      limitType: FeatureLimitType.COUNT,
      limitValue: 3,
      featureType: FeatureType.RESOURCE,
    },
    {
      featureCode: 'transactions_per_month',
      limitType: FeatureLimitType.COUNT,
      limitValue: 100,
      featureType: FeatureType.CONSUMABLE,
      limitPeriod: LimitPeriod.MONTHLY,
    },
    {
      featureCode: 'advanced_reports',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 0,
    },
    {
      featureCode: 'export_data',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 0,
    },
    {
      featureCode: 'multi_currency',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 0,
    },
    {
      featureCode: 'budget_alerts',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 0,
    },
    {
      featureCode: 'ai_insights',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 0,
    },
  ],
  pro: [
    {
      featureCode: 'accounts',
      limitType: FeatureLimitType.COUNT,
      limitValue: 10,
      featureType: FeatureType.RESOURCE,
    },
    {
      featureCode: 'goals',
      limitType: FeatureLimitType.COUNT,
      limitValue: 5,
      featureType: FeatureType.RESOURCE,
    },
    {
      featureCode: 'debts',
      limitType: FeatureLimitType.COUNT,
      limitValue: 10,
      featureType: FeatureType.RESOURCE,
    },
    {
      featureCode: 'loans',
      limitType: FeatureLimitType.COUNT,
      limitValue: 5,
      featureType: FeatureType.RESOURCE,
    },
    {
      featureCode: 'custom_categories',
      limitType: FeatureLimitType.COUNT,
      limitValue: 20,
      featureType: FeatureType.RESOURCE,
    },
    {
      featureCode: 'recurring_payments',
      limitType: FeatureLimitType.COUNT,
      limitValue: 20,
      featureType: FeatureType.RESOURCE,
    },
    {
      featureCode: 'transactions_per_month',
      limitType: FeatureLimitType.COUNT,
      limitValue: 1000,
      featureType: FeatureType.CONSUMABLE,
      limitPeriod: LimitPeriod.MONTHLY,
    },
    {
      featureCode: 'advanced_reports',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 1,
    },
    {
      featureCode: 'export_data',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 1,
    },
    {
      featureCode: 'multi_currency',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 0,
    },
    {
      featureCode: 'budget_alerts',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 1,
    },
    {
      featureCode: 'ai_insights',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 0,
    },
  ],
  premium: [
    {
      featureCode: 'accounts',
      limitType: FeatureLimitType.UNLIMITED,
      limitValue: -1,
    },
    {
      featureCode: 'goals',
      limitType: FeatureLimitType.UNLIMITED,
      limitValue: -1,
    },
    {
      featureCode: 'debts',
      limitType: FeatureLimitType.UNLIMITED,
      limitValue: -1,
    },
    {
      featureCode: 'loans',
      limitType: FeatureLimitType.UNLIMITED,
      limitValue: -1,
    },
    {
      featureCode: 'custom_categories',
      limitType: FeatureLimitType.UNLIMITED,
      limitValue: -1,
    },
    {
      featureCode: 'recurring_payments',
      limitType: FeatureLimitType.UNLIMITED,
      limitValue: -1,
    },
    {
      featureCode: 'transactions_per_month',
      limitType: FeatureLimitType.UNLIMITED,
      limitValue: -1,
    },
    {
      featureCode: 'advanced_reports',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 1,
    },
    {
      featureCode: 'export_data',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 1,
    },
    {
      featureCode: 'multi_currency',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 1,
    },
    {
      featureCode: 'budget_alerts',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 1,
    },
    {
      featureCode: 'ai_insights',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 1,
    },
  ],
};

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
  aiGatewayClientMock.executeChatCompletion.mockReset();
  mailProviderMock.send.mockReset();
  mailProviderMock.sendTemplate.mockReset();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ThrottlerGuard)
    .useClass(NoopThrottlerGuard)
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
    .useValue(mailProviderMock)
    .compile();

  const app = moduleFixture.createNestApplication();
  const httpAdapterHost = app.get(HttpAdapterHost);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
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
  await ensureReferenceSeedData(app.get(PrismaService));

  return app;
}

/**
 * Create a fully bootstrapped workspace-aware test user directly in the DB
 * (bypassing the public registration flow). The created fixture includes:
 * - active user
 * - personal workspace
 * - active workspace membership
 * - workspace settings
 * - active free subscription
 * - JWT access token with workspace-aware claims
 */
export async function createTestUser(
  app: INestApplication,
  overrides: {
    email?: string;
    firstName?: string;
    lastName?: string;
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
    const freePlan = await tx.plan.findFirst({
      where: { isDefault: true, isActive: true },
    });

    if (!freePlan) {
      throw new Error('Default plan not configured for E2E tests');
    }

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
        platformRole: PlatformRole.USER,
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

    await tx.subscription.create({
      data: {
        workspaceId: workspace.id,
        planId: freePlan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: null,
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
      prisma.account.deleteMany({ where: { workspaceId } }),
      prisma.category.deleteMany({ where: { workspaceId, isSystem: false } }),
      prisma.usageRecord.deleteMany({ where: { workspaceId } }),
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
  await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {
      name: 'US Dollar',
      symbol: '$',
      decimalScale: 2,
      isActive: true,
    },
    create: {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      decimalScale: 2,
      isActive: true,
    },
  });

  for (const planSeed of TEST_PLAN_SEEDS) {
    const plan = await prisma.plan.upsert({
      where: { code: planSeed.code },
      update: {
        name: planSeed.name,
        description: planSeed.description,
        priceMonthly: planSeed.priceMonthly,
        priceYearly: planSeed.priceYearly,
        isActive: true,
        isDefault: planSeed.isDefault,
        sortOrder: planSeed.sortOrder,
      },
      create: {
        code: planSeed.code,
        name: planSeed.name,
        description: planSeed.description,
        priceMonthly: planSeed.priceMonthly,
        priceYearly: planSeed.priceYearly,
        isActive: true,
        isDefault: planSeed.isDefault,
        sortOrder: planSeed.sortOrder,
      },
    });

    const featureSeeds = TEST_PLAN_FEATURE_SEEDS[planSeed.code] ?? [];

    for (const featureSeed of featureSeeds) {
      await prisma.planFeature.upsert({
        where: {
          planId_featureCode: {
            planId: plan.id,
            featureCode: featureSeed.featureCode,
          },
        },
        update: {
          limitType: featureSeed.limitType,
          limitValue: featureSeed.limitValue,
          featureType: featureSeed.featureType ?? FeatureType.RESOURCE,
          limitPeriod: featureSeed.limitPeriod ?? null,
        },
        create: {
          planId: plan.id,
          featureCode: featureSeed.featureCode,
          limitType: featureSeed.limitType,
          limitValue: featureSeed.limitValue,
          featureType: featureSeed.featureType ?? FeatureType.RESOURCE,
          limitPeriod: featureSeed.limitPeriod,
        },
      });
    }
  }

  for (const categorySeed of SYSTEM_CATEGORIES) {
    const existingParent = await prisma.category.findFirst({
      where: {
        name: categorySeed.name,
        type: categorySeed.type,
        isSystem: true,
        parentId: null,
      },
    });

    const parent = existingParent
      ? await prisma.category.update({
          where: { id: existingParent.id },
          data: {
            icon: categorySeed.icon,
            color: categorySeed.color,
            sortOrder: categorySeed.sortOrder,
            isActive: true,
          },
        })
      : await prisma.category.create({
          data: {
            name: categorySeed.name,
            type: categorySeed.type,
            icon: categorySeed.icon,
            color: categorySeed.color,
            sortOrder: categorySeed.sortOrder,
            isSystem: true,
            isActive: true,
          },
        });

    if (!categorySeed.children) {
      continue;
    }

    for (const childSeed of categorySeed.children) {
      const existingChild = await prisma.category.findFirst({
        where: {
          name: childSeed.name,
          type: categorySeed.type,
          isSystem: true,
          parentId: parent.id,
        },
      });

      if (existingChild) {
        await prisma.category.update({
          where: { id: existingChild.id },
          data: {
            icon: childSeed.icon,
            color: childSeed.color,
            sortOrder: childSeed.sortOrder,
            isActive: true,
          },
        });

        continue;
      }

      await prisma.category.create({
        data: {
          name: childSeed.name,
          type: categorySeed.type,
          parentId: parent.id,
          icon: childSeed.icon,
          color: childSeed.color,
          sortOrder: childSeed.sortOrder,
          isSystem: true,
          isActive: true,
        },
      });
    }
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
