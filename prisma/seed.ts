import 'dotenv/config';

import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { parseArgs } from 'node:util';

import {
  PlatformRole,
  Prisma,
  PrismaClient,
  SubscriptionStatus,
  UserStatus,
  WorkspaceMembershipStatus,
  WorkspaceRole,
  WorkspaceStatus,
  WorkspaceType,
} from '@/generated/prisma/client';

type SeedCurrency = {
  code: string;
  name: string;
  symbol: string;
  decimalScale: number;
};

type SeedCountry = {
  code: string;
  name: string;
  defaultCurrencyCode: string;
  callingCode: string;
  defaultLocale: string;
};

type SeedDiffStatus = 'create' | 'update' | 'unchanged';

type TableSeedSummary = {
  created: number;
  updated: number;
  unchanged: number;
};

type SuperAdminSummary = {
  user: SeedDiffStatus;
  workspace: 'created' | 'reused';
  membership: SeedDiffStatus;
  settings: SeedDiffStatus;
  subscription: SeedDiffStatus;
  profile: SeedDiffStatus;
  usedFallbackCredentials: boolean;
};

type SuperAdminSeedInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  workspaceName: string;
  countryCode: string;
  usedFallbackCredentials: boolean;
  fallbackFields: string[];
};

const SEED_COMMAND =
  'pnpm exec ts-node --transpile-only -r tsconfig-paths/register prisma/seed.ts';

// Source basis for LATAM reference data:
// - Country names, alpha-2 codes, locales, and calling codes are curated from
//   the public REST Countries dataset (restcountries.com) and then normalized
//   manually for application defaults.
// - Currency codes and decimal scales are manually aligned with current ISO 4217
//   behavior to avoid historical drift in reference APIs.
// Scope is intentionally limited to sovereign LATAM countries only.
const LATAM_CURRENCIES: SeedCurrency[] = [
  { code: 'ARS', name: 'Argentine Peso', symbol: '$', decimalScale: 2 },
  { code: 'BOB', name: 'Bolivian Boliviano', symbol: 'Bs.', decimalScale: 2 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimalScale: 2 },
  { code: 'CLP', name: 'Chilean Peso', symbol: '$', decimalScale: 0 },
  { code: 'COP', name: 'Colombian Peso', symbol: '$', decimalScale: 2 },
  { code: 'CRC', name: 'Costa Rican Colón', symbol: '₡', decimalScale: 2 },
  { code: 'CUP', name: 'Cuban Peso', symbol: '$', decimalScale: 2 },
  { code: 'DOP', name: 'Dominican Peso', symbol: 'RD$', decimalScale: 2 },
  { code: 'GTQ', name: 'Guatemalan Quetzal', symbol: 'Q', decimalScale: 2 },
  { code: 'HTG', name: 'Haitian Gourde', symbol: 'G', decimalScale: 2 },
  { code: 'HNL', name: 'Honduran Lempira', symbol: 'L', decimalScale: 2 },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$', decimalScale: 2 },
  { code: 'NIO', name: 'Nicaraguan Córdoba', symbol: 'C$', decimalScale: 2 },
  { code: 'PAB', name: 'Panamanian Balboa', symbol: 'B/.', decimalScale: 2 },
  { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/', decimalScale: 2 },
  { code: 'PYG', name: 'Paraguayan Guaraní', symbol: '₲', decimalScale: 0 },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimalScale: 2 },
  { code: 'UYU', name: 'Uruguayan Peso', symbol: '$U', decimalScale: 2 },
  { code: 'VES', name: 'Venezuelan Bolívar', symbol: 'Bs.', decimalScale: 2 },
];

const LATAM_COUNTRIES: SeedCountry[] = [
  {
    code: 'AR',
    name: 'Argentina',
    defaultCurrencyCode: 'ARS',
    callingCode: '+54',
    defaultLocale: 'es-AR',
  },
  {
    code: 'BO',
    name: 'Bolivia',
    defaultCurrencyCode: 'BOB',
    callingCode: '+591',
    defaultLocale: 'es-BO',
  },
  {
    code: 'BR',
    name: 'Brazil',
    defaultCurrencyCode: 'BRL',
    callingCode: '+55',
    defaultLocale: 'pt-BR',
  },
  {
    code: 'CL',
    name: 'Chile',
    defaultCurrencyCode: 'CLP',
    callingCode: '+56',
    defaultLocale: 'es-CL',
  },
  {
    code: 'CO',
    name: 'Colombia',
    defaultCurrencyCode: 'COP',
    callingCode: '+57',
    defaultLocale: 'es-CO',
  },
  {
    code: 'CR',
    name: 'Costa Rica',
    defaultCurrencyCode: 'CRC',
    callingCode: '+506',
    defaultLocale: 'es-CR',
  },
  {
    code: 'CU',
    name: 'Cuba',
    defaultCurrencyCode: 'CUP',
    callingCode: '+53',
    defaultLocale: 'es-CU',
  },
  {
    code: 'DO',
    name: 'Dominican Republic',
    defaultCurrencyCode: 'DOP',
    callingCode: '+1',
    defaultLocale: 'es-DO',
  },
  {
    code: 'EC',
    name: 'Ecuador',
    defaultCurrencyCode: 'USD',
    callingCode: '+593',
    defaultLocale: 'es-EC',
  },
  {
    code: 'SV',
    name: 'El Salvador',
    defaultCurrencyCode: 'USD',
    callingCode: '+503',
    defaultLocale: 'es-SV',
  },
  {
    code: 'GT',
    name: 'Guatemala',
    defaultCurrencyCode: 'GTQ',
    callingCode: '+502',
    defaultLocale: 'es-GT',
  },
  {
    code: 'HT',
    name: 'Haiti',
    defaultCurrencyCode: 'HTG',
    callingCode: '+509',
    defaultLocale: 'fr-HT',
  },
  {
    code: 'HN',
    name: 'Honduras',
    defaultCurrencyCode: 'HNL',
    callingCode: '+504',
    defaultLocale: 'es-HN',
  },
  {
    code: 'MX',
    name: 'Mexico',
    defaultCurrencyCode: 'MXN',
    callingCode: '+52',
    defaultLocale: 'es-MX',
  },
  {
    code: 'NI',
    name: 'Nicaragua',
    defaultCurrencyCode: 'NIO',
    callingCode: '+505',
    defaultLocale: 'es-NI',
  },
  {
    code: 'PA',
    name: 'Panama',
    defaultCurrencyCode: 'PAB',
    callingCode: '+507',
    defaultLocale: 'es-PA',
  },
  {
    code: 'PY',
    name: 'Paraguay',
    defaultCurrencyCode: 'PYG',
    callingCode: '+595',
    defaultLocale: 'es-PY',
  },
  {
    code: 'PE',
    name: 'Peru',
    defaultCurrencyCode: 'PEN',
    callingCode: '+51',
    defaultLocale: 'es-PE',
  },
  {
    code: 'UY',
    name: 'Uruguay',
    defaultCurrencyCode: 'UYU',
    callingCode: '+598',
    defaultLocale: 'es-UY',
  },
  {
    code: 'VE',
    name: 'Venezuela',
    defaultCurrencyCode: 'VES',
    callingCode: '+58',
    defaultLocale: 'es-VE',
  },
];

const FREE_PLAN_CODE = 'FREE';

const FREE_PLAN_DATA = {
  code: FREE_PLAN_CODE,
  name: 'Free',
  description: 'Default free plan for new and seeded workspaces.',
  priceMonthly: new Prisma.Decimal('0'),
  priceCurrency: 'USD',
  priceYearly: null,
  isActive: true,
  isDefault: true,
  sortOrder: 0,
} satisfies Prisma.PlanUncheckedCreateInput;

function isCurrencyChanged(
  existing: {
    name: string;
    symbol: string;
    decimalScale: number;
    isActive: boolean;
  },
  nextValue: SeedCurrency,
): boolean {
  return (
    existing.name !== nextValue.name ||
    existing.symbol !== nextValue.symbol ||
    existing.decimalScale !== nextValue.decimalScale ||
    existing.isActive !== true
  );
}

function isCountryChanged(
  existing: {
    name: string;
    defaultCurrencyCode: string;
    callingCode: string;
    defaultLocale: string;
    isActive: boolean;
  },
  nextValue: SeedCountry,
): boolean {
  return (
    existing.name !== nextValue.name ||
    existing.defaultCurrencyCode !== nextValue.defaultCurrencyCode ||
    existing.callingCode !== nextValue.callingCode ||
    existing.defaultLocale !== nextValue.defaultLocale ||
    existing.isActive !== true
  );
}

function isPlanChanged(existing: {
  name: string;
  description: string | null;
  priceMonthly: Prisma.Decimal;
  priceCurrency: string;
  priceYearly: Prisma.Decimal | null;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
}): boolean {
  return (
    existing.name !== FREE_PLAN_DATA.name ||
    existing.description !== FREE_PLAN_DATA.description ||
    !existing.priceMonthly.equals(FREE_PLAN_DATA.priceMonthly) ||
    existing.priceCurrency !== FREE_PLAN_DATA.priceCurrency ||
    existing.priceYearly !== null ||
    existing.isActive !== FREE_PLAN_DATA.isActive ||
    existing.isDefault !== FREE_PLAN_DATA.isDefault ||
    existing.sortOrder !== FREE_PLAN_DATA.sortOrder
  );
}

function incrementSummary(
  summary: TableSeedSummary,
  status: SeedDiffStatus,
): void {
  if (status === 'create') {
    summary.created += 1;
    return;
  }

  if (status === 'update') {
    summary.updated += 1;
    return;
  }

  summary.unchanged += 1;
}

function toSeedStatus(created: boolean, changed: boolean): SeedDiffStatus {
  if (created) {
    return 'create';
  }

  return changed ? 'update' : 'unchanged';
}

function normalizeCountryCode(countryCode: string): string {
  return countryCode.trim().toUpperCase();
}

function resolveSuperAdminSeedInput(): SuperAdminSeedInput {
  const fallback = {
    email: 'superadmin@facets.local',
    password: 'ChangeMe123!',
    firstName: 'Facets',
    lastName: 'Admin',
    workspaceName: 'Facets Admin Workspace',
    countryCode: 'AR',
  } as const;

  const input = {
    email: process.env['SEED_SUPER_ADMIN_EMAIL']?.trim() || fallback.email,
    password:
      process.env['SEED_SUPER_ADMIN_PASSWORD']?.trim() || fallback.password,
    firstName:
      process.env['SEED_SUPER_ADMIN_FIRST_NAME']?.trim() || fallback.firstName,
    lastName:
      process.env['SEED_SUPER_ADMIN_LAST_NAME']?.trim() || fallback.lastName,
    workspaceName:
      process.env['SEED_SUPER_ADMIN_WORKSPACE_NAME']?.trim() ||
      fallback.workspaceName,
    countryCode: normalizeCountryCode(
      process.env['SEED_SUPER_ADMIN_COUNTRY_CODE'] || fallback.countryCode,
    ),
  };

  const fallbackFields = [
    !process.env['SEED_SUPER_ADMIN_EMAIL'] ? 'SEED_SUPER_ADMIN_EMAIL' : null,
    !process.env['SEED_SUPER_ADMIN_PASSWORD']
      ? 'SEED_SUPER_ADMIN_PASSWORD'
      : null,
  ].filter((value): value is string => value !== null);

  return {
    ...input,
    usedFallbackCredentials: fallbackFields.length > 0,
    fallbackFields,
  };
}

async function seedCurrencies(
  prisma: PrismaClient,
  dryRun: boolean,
): Promise<TableSeedSummary> {
  const summary: TableSeedSummary = { created: 0, updated: 0, unchanged: 0 };

  const existingRows = await prisma.currency.findMany({
    where: {
      code: {
        in: LATAM_CURRENCIES.map((currency) => currency.code),
      },
    },
  });

  const existingByCode = new Map(existingRows.map((row) => [row.code, row]));
  const operations: Promise<unknown>[] = [];

  for (const currency of LATAM_CURRENCIES) {
    const existing = existingByCode.get(currency.code);
    const status = toSeedStatus(
      existing === undefined,
      existing !== undefined && isCurrencyChanged(existing, currency),
    );

    incrementSummary(summary, status);

    if (dryRun) {
      continue;
    }

    operations.push(
      prisma.currency.upsert({
        where: { code: currency.code },
        create: {
          ...currency,
          isActive: true,
        },
        update: {
          ...currency,
          isActive: true,
        },
      }),
    );
  }

  if (!dryRun) {
    await Promise.all(operations);
  }

  return summary;
}

async function seedCountries(
  prisma: PrismaClient,
  dryRun: boolean,
): Promise<TableSeedSummary> {
  const summary: TableSeedSummary = { created: 0, updated: 0, unchanged: 0 };

  const existingRows = await prisma.country.findMany({
    where: {
      code: {
        in: LATAM_COUNTRIES.map((country) => country.code),
      },
    },
  });

  const existingByCode = new Map(existingRows.map((row) => [row.code, row]));
  const operations: Promise<unknown>[] = [];

  for (const country of LATAM_COUNTRIES) {
    const existing = existingByCode.get(country.code);
    const status = toSeedStatus(
      existing === undefined,
      existing !== undefined && isCountryChanged(existing, country),
    );

    incrementSummary(summary, status);

    if (dryRun) {
      continue;
    }

    operations.push(
      prisma.country.upsert({
        where: { code: country.code },
        create: {
          ...country,
          isActive: true,
        },
        update: {
          ...country,
          isActive: true,
        },
      }),
    );
  }

  if (!dryRun) {
    await Promise.all(operations);
  }

  return summary;
}

async function seedFreePlan(
  prisma: PrismaClient,
  dryRun: boolean,
): Promise<{ status: SeedDiffStatus; clearedOtherDefaults: number }> {
  const existingPlan = await prisma.plan.findUnique({
    where: { code: FREE_PLAN_CODE },
  });

  const otherDefaultPlans = await prisma.plan.count({
    where: {
      code: { not: FREE_PLAN_CODE },
      isDefault: true,
    },
  });

  const status = toSeedStatus(
    existingPlan === null,
    existingPlan !== null &&
      (isPlanChanged(existingPlan) || otherDefaultPlans > 0),
  );

  if (!dryRun) {
    if (otherDefaultPlans > 0) {
      await prisma.plan.updateMany({
        where: {
          code: { not: FREE_PLAN_CODE },
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    await prisma.plan.upsert({
      where: { code: FREE_PLAN_CODE },
      create: FREE_PLAN_DATA,
      update: FREE_PLAN_DATA,
    });
  }

  return {
    status,
    clearedOtherDefaults: otherDefaultPlans,
  };
}

async function seedSuperAdmin(
  prisma: PrismaClient,
  dryRun: boolean,
): Promise<SuperAdminSummary> {
  const input = resolveSuperAdminSeedInput();
  const adminCountry = LATAM_COUNTRIES.find(
    (country) => country.code === input.countryCode,
  );

  if (!adminCountry) {
    throw new Error(
      `Unsupported SEED_SUPER_ADMIN_COUNTRY_CODE \"${input.countryCode}\". Use one of: ${LATAM_COUNTRIES.map((country) => country.code).join(', ')}`,
    );
  }

  if (input.usedFallbackCredentials) {
    console.warn(
      `[seed] WARNING: using fallback local super admin credentials for ${input.fallbackFields.join(', ')}. Set these env vars before running in shared environments.`,
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    include: {
      profile: true,
      memberships: {
        include: {
          workspace: {
            include: {
              settings: true,
              subscription: true,
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }],
      },
    },
  });

  const passwordNeedsUpdate = existingUser
    ? !(await argon2
        .verify(existingUser.password, input.password)
        .catch(() => false))
    : false;

  const workspaceContext = existingUser?.memberships[0] ?? null;
  const settings = workspaceContext?.workspace.settings ?? null;
  const subscription = workspaceContext?.workspace.subscription ?? null;
  const freePlan = dryRun
    ? await prisma.plan.findUnique({
        where: { code: FREE_PLAN_CODE },
      })
    : await prisma.plan.findUniqueOrThrow({
        where: { code: FREE_PLAN_CODE },
      });

  const freePlanSnapshot = {
    id: freePlan?.id ?? 'dry-run-free-plan',
    code: freePlan?.code ?? FREE_PLAN_DATA.code,
    name: freePlan?.name ?? FREE_PLAN_DATA.name,
    priceCurrency: freePlan?.priceCurrency ?? FREE_PLAN_DATA.priceCurrency,
  };

  const userStatus = toSeedStatus(
    existingUser === null,
    existingUser !== null &&
      (existingUser.firstName !== input.firstName ||
        existingUser.lastName !== input.lastName ||
        existingUser.platformRole !== PlatformRole.SUPER_ADMIN ||
        existingUser.status !== UserStatus.ACTIVE ||
        existingUser.emailVerified !== true ||
        existingUser.emailVerifiedAt === null ||
        passwordNeedsUpdate),
  );

  const membershipStatus = toSeedStatus(
    workspaceContext === null,
    workspaceContext !== null &&
      (workspaceContext.role !== WorkspaceRole.ADMIN ||
        workspaceContext.status !== WorkspaceMembershipStatus.ACTIVE ||
        workspaceContext.joinedAt === null),
  );

  const settingsStatus = toSeedStatus(
    settings === null,
    settings !== null &&
      (settings.baseCurrencyCode !== adminCountry.defaultCurrencyCode ||
        settings.contentLocale !== adminCountry.defaultLocale ||
        settings.dateFormat !== 'DD/MM/YYYY' ||
        settings.financialTimezone !== 'UTC' ||
        settings.monthStartDay !== 1 ||
        settings.weekStartDay !== 1),
  );

  const subscriptionStatus = toSeedStatus(
    subscription === null,
    subscription !== null &&
      (subscription.planId !== freePlanSnapshot.id ||
        subscription.planCodeSnapshot !== freePlanSnapshot.code ||
        subscription.planNameSnapshot !== freePlanSnapshot.name ||
        subscription.billingInterval !== null ||
        !subscription.billingAmount.equals(new Prisma.Decimal('0')) ||
        subscription.billingCurrency !== freePlanSnapshot.priceCurrency ||
        subscription.status !== SubscriptionStatus.ACTIVE ||
        subscription.currentPeriodEnd !== null ||
        subscription.cancelledAt !== null ||
        subscription.cancelReason !== null ||
        subscription.gracePeriodEnd !== null),
  );

  const profileStatus = toSeedStatus(
    existingUser?.profile === null || existingUser?.profile === undefined,
    Boolean(
      existingUser?.profile &&
      existingUser.profile.countryCode !== adminCountry.code,
    ),
  );

  if (dryRun) {
    return {
      user: userStatus,
      workspace: workspaceContext ? 'reused' : 'created',
      membership: membershipStatus,
      settings: settingsStatus,
      subscription: subscriptionStatus,
      profile: profileStatus,
      usedFallbackCredentials: input.usedFallbackCredentials,
    };
  }

  const now = new Date();

  await prisma.$transaction(
    async (tx) => {
      const passwordHash = passwordNeedsUpdate
        ? await argon2.hash(input.password)
        : existingUser?.password;

      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              firstName: input.firstName,
              lastName: input.lastName,
              platformRole: PlatformRole.SUPER_ADMIN,
              status: UserStatus.ACTIVE,
              emailVerified: true,
              emailVerifiedAt: existingUser.emailVerifiedAt ?? now,
              ...(passwordHash ? { password: passwordHash } : {}),
            },
          })
        : await tx.user.create({
            data: {
              email: input.email.toLowerCase(),
              password: await argon2.hash(input.password),
              firstName: input.firstName,
              lastName: input.lastName,
              platformRole: PlatformRole.SUPER_ADMIN,
              status: UserStatus.ACTIVE,
              emailVerified: true,
              emailVerifiedAt: now,
            },
          });

      const workspace = workspaceContext?.workspace
        ? await tx.workspace.update({
            where: { id: workspaceContext.workspace.id },
            data: {
              status: WorkspaceStatus.ACTIVE,
            },
          })
        : await tx.workspace.create({
            data: {
              name: input.workspaceName,
              type: WorkspaceType.PERSONAL,
              status: WorkspaceStatus.ACTIVE,
            },
          });

      await tx.workspaceMembership.upsert({
        where: {
          workspace_memberships_workspace_user_unique: {
            workspaceId: workspace.id,
            userId: user.id,
          },
        },
        create: {
          workspaceId: workspace.id,
          userId: user.id,
          role: WorkspaceRole.ADMIN,
          status: WorkspaceMembershipStatus.ACTIVE,
          joinedAt: now,
        },
        update: {
          role: WorkspaceRole.ADMIN,
          status: WorkspaceMembershipStatus.ACTIVE,
          joinedAt: workspaceContext?.joinedAt ?? now,
        },
      });

      await tx.workspaceSettings.upsert({
        where: {
          workspaceId: workspace.id,
        },
        create: {
          workspaceId: workspace.id,
          baseCurrencyCode: adminCountry.defaultCurrencyCode,
          contentLocale: adminCountry.defaultLocale,
          dateFormat: 'DD/MM/YYYY',
          financialTimezone: 'UTC',
          monthStartDay: 1,
          weekStartDay: 1,
        },
        update: {
          baseCurrencyCode: adminCountry.defaultCurrencyCode,
          contentLocale: adminCountry.defaultLocale,
          dateFormat: 'DD/MM/YYYY',
          financialTimezone: 'UTC',
          monthStartDay: 1,
          weekStartDay: 1,
        },
      });

      await tx.subscription.upsert({
        where: {
          workspaceId: workspace.id,
        },
        create: {
          workspaceId: workspace.id,
          planId: freePlanSnapshot.id,
          planCodeSnapshot: freePlanSnapshot.code,
          planNameSnapshot: freePlanSnapshot.name,
          billingInterval: null,
          billingAmount: new Prisma.Decimal('0'),
          billingCurrency: freePlanSnapshot.priceCurrency,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: null,
        },
        update: {
          planId: freePlanSnapshot.id,
          planCodeSnapshot: freePlanSnapshot.code,
          planNameSnapshot: freePlanSnapshot.name,
          billingInterval: null,
          billingAmount: new Prisma.Decimal('0'),
          billingCurrency: freePlanSnapshot.priceCurrency,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: null,
          cancelledAt: null,
          cancelReason: null,
          gracePeriodEnd: null,
        },
      });

      await tx.userProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          countryCode: adminCountry.code,
        },
        update: {
          countryCode: adminCountry.code,
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  return {
    user: userStatus,
    workspace: workspaceContext ? 'reused' : 'created',
    membership: membershipStatus,
    settings: settingsStatus,
    subscription: subscriptionStatus,
    profile: profileStatus,
    usedFallbackCredentials: input.usedFallbackCredentials,
  };
}

function logTableSummary(label: string, summary: TableSeedSummary): void {
  console.log(
    `[seed] ${label}: ${summary.created} created, ${summary.updated} updated, ${summary.unchanged} unchanged`,
  );
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'dry-run': {
        type: 'boolean',
      },
    },
    allowPositionals: true,
  });

  if (positionals.length > 0) {
    throw new Error(
      `Unexpected positional arguments: ${positionals.join(' ')}. Use \"prisma db seed -- --dry-run\" for dry runs.`,
    );
  }

  const dryRun = values['dry-run'] === true;
  const databaseUrl = process.env['DATABASE_URL'];

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run the Prisma seed.');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: dryRun ? 4 : 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  });

  try {
    await prisma.$connect();

    console.log(
      `[seed] Starting Prisma seed${dryRun ? ' (dry run)' : ''} using command: ${SEED_COMMAND}`,
    );

    const currencySummary = await seedCurrencies(prisma, dryRun);
    const countrySummary = await seedCountries(prisma, dryRun);
    const planSummary = await seedFreePlan(prisma, dryRun);
    const superAdminSummary = await seedSuperAdmin(prisma, dryRun);

    logTableSummary('currencies', currencySummary);
    logTableSummary('countries', countrySummary);
    console.log(
      `[seed] free plan: ${planSummary.status}${planSummary.clearedOtherDefaults > 0 ? `, cleared ${planSummary.clearedOtherDefaults} other default plan(s)` : ''}`,
    );
    console.log(
      `[seed] super admin: user=${superAdminSummary.user}, workspace=${superAdminSummary.workspace}, membership=${superAdminSummary.membership}, settings=${superAdminSummary.settings}, subscription=${superAdminSummary.subscription}, profile=${superAdminSummary.profile}`,
    );

    if (dryRun) {
      console.log(
        '[seed] Dry run completed. No database writes were performed.',
      );
      return;
    }

    console.log('[seed] Seed completed successfully.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.stack || error.message : String(error);
  console.error(`[seed] Failed: ${message}`);
  process.exit(1);
});
