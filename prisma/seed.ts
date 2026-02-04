import 'dotenv/config';
import {
  PrismaClient,
  FeatureLimitType,
  FeatureType,
  LimitPeriod,
} from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Seed data for subscription plans and features
 *
 * This script is idempotent - it uses upsert to safely run multiple times.
 */

interface PlanSeedData {
  code: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly?: number;
  isDefault: boolean;
  sortOrder: number;
}

interface FeatureSeedData {
  featureCode: string;
  limitType: FeatureLimitType;
  limitValue: number;
  featureType?: FeatureType;
  limitPeriod?: LimitPeriod;
}

const plans: PlanSeedData[] = [
  {
    code: 'free',
    name: 'Free',
    description: 'Perfect for getting started with personal finance tracking',
    priceMonthly: 0,
    isDefault: true,
    sortOrder: 0,
  },
  {
    code: 'pro',
    name: 'Pro',
    description: 'For power users who need more flexibility and features',
    priceMonthly: 4.99,
    priceYearly: 49.99,
    isDefault: false,
    sortOrder: 1,
  },
  {
    code: 'premium',
    name: 'Premium',
    description: 'Complete financial management with all features unlocked',
    priceMonthly: 9.99,
    priceYearly: 99.99,
    isDefault: false,
    sortOrder: 2,
  },
];

const features: Record<string, FeatureSeedData[]> = {
  free: [
    // RESOURCE limits (count from actual tables)
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
    // CONSUMABLE limits (count from UsageRecord, period-based)
    {
      featureCode: 'transactions_per_month',
      limitType: FeatureLimitType.COUNT,
      limitValue: 100,
      featureType: FeatureType.CONSUMABLE,
      limitPeriod: LimitPeriod.MONTHLY,
    },
    // BOOLEAN features (on/off)
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
    // RESOURCE limits
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
    // CONSUMABLE limits
    {
      featureCode: 'transactions_per_month',
      limitType: FeatureLimitType.COUNT,
      limitValue: 1000,
      featureType: FeatureType.CONSUMABLE,
      limitPeriod: LimitPeriod.MONTHLY,
    },
    // BOOLEAN features
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
    // UNLIMITED resources
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
    // BOOLEAN features (all enabled)
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

async function main() {
  console.log('🌱 Starting seed...');

  // Upsert plans
  for (const planData of plans) {
    const plan = await prisma.plan.upsert({
      where: { code: planData.code },
      update: {
        name: planData.name,
        description: planData.description,
        priceMonthly: planData.priceMonthly,
        priceYearly: planData.priceYearly,
        isDefault: planData.isDefault,
        sortOrder: planData.sortOrder,
        isActive: true,
      },
      create: {
        code: planData.code,
        name: planData.name,
        description: planData.description,
        priceMonthly: planData.priceMonthly,
        priceYearly: planData.priceYearly,
        isDefault: planData.isDefault,
        sortOrder: planData.sortOrder,
        isActive: true,
      },
    });

    console.log(`  ✓ Plan "${plan.name}" (${plan.code})`);

    // Upsert features for this plan
    const planFeatures = features[planData.code];
    if (planFeatures) {
      for (const featureData of planFeatures) {
        await prisma.planFeature.upsert({
          where: {
            planId_featureCode: {
              planId: plan.id,
              featureCode: featureData.featureCode,
            },
          },
          update: {
            limitType: featureData.limitType,
            limitValue: featureData.limitValue,
            featureType: featureData.featureType ?? FeatureType.RESOURCE,
            limitPeriod: featureData.limitPeriod,
          },
          create: {
            planId: plan.id,
            featureCode: featureData.featureCode,
            limitType: featureData.limitType,
            limitValue: featureData.limitValue,
            featureType: featureData.featureType ?? FeatureType.RESOURCE,
            limitPeriod: featureData.limitPeriod,
          },
        });
      }
      console.log(`    → ${planFeatures.length} features configured`);
    }
  }

  console.log('\n✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
