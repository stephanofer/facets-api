import 'dotenv/config';
import {
  PrismaClient,
  FeatureLimitType,
  FeatureType,
  PreferenceCategory,
  PreferenceDataType,
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

// =============================================================================
// Reference Data: Currencies (ISO 4217)
// =============================================================================

interface CurrencySeedData {
  code: string;
  name: string;
  symbol: string;
  decimalScale: number;
}

const currencies: CurrencySeedData[] = [
  // Americas
  { code: 'USD', name: 'US Dollar', symbol: '$', decimalScale: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimalScale: 2 },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$', decimalScale: 2 },
  { code: 'ARS', name: 'Argentine Peso', symbol: '$', decimalScale: 2 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimalScale: 2 },
  { code: 'CLP', name: 'Chilean Peso', symbol: '$', decimalScale: 0 },
  { code: 'COP', name: 'Colombian Peso', symbol: '$', decimalScale: 2 },
  { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/', decimalScale: 2 },
  { code: 'UYU', name: 'Uruguayan Peso', symbol: '$U', decimalScale: 2 },
  // Europe
  { code: 'EUR', name: 'Euro', symbol: '€', decimalScale: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimalScale: 2 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimalScale: 2 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', decimalScale: 2 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', decimalScale: 2 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', decimalScale: 2 },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', decimalScale: 2 },
  // Asia & Oceania
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimalScale: 0 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimalScale: 2 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimalScale: 0 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimalScale: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimalScale: 2 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', decimalScale: 2 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimalScale: 2 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimalScale: 2 },
  { code: 'TWD', name: 'Taiwan Dollar', symbol: 'NT$', decimalScale: 2 },
  // Middle East & Africa
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimalScale: 2 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', decimalScale: 2 },
  { code: 'ILS', name: 'Israeli Shekel', symbol: '₪', decimalScale: 2 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimalScale: 2 },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', decimalScale: 2 },
];

// =============================================================================
// Reference Data: Countries (ISO 3166-1 alpha-2)
// =============================================================================

interface CountrySeedData {
  code: string;
  name: string;
  currencyCode: string;
  phoneCode: string;
  locale: string;
}

const countries: CountrySeedData[] = [
  // Americas
  {
    code: 'US',
    name: 'United States',
    currencyCode: 'USD',
    phoneCode: '+1',
    locale: 'en-US',
  },
  {
    code: 'CA',
    name: 'Canada',
    currencyCode: 'CAD',
    phoneCode: '+1',
    locale: 'en-CA',
  },
  {
    code: 'MX',
    name: 'Mexico',
    currencyCode: 'MXN',
    phoneCode: '+52',
    locale: 'es-MX',
  },
  {
    code: 'AR',
    name: 'Argentina',
    currencyCode: 'ARS',
    phoneCode: '+54',
    locale: 'es-AR',
  },
  {
    code: 'BR',
    name: 'Brazil',
    currencyCode: 'BRL',
    phoneCode: '+55',
    locale: 'pt-BR',
  },
  {
    code: 'CL',
    name: 'Chile',
    currencyCode: 'CLP',
    phoneCode: '+56',
    locale: 'es-CL',
  },
  {
    code: 'CO',
    name: 'Colombia',
    currencyCode: 'COP',
    phoneCode: '+57',
    locale: 'es-CO',
  },
  {
    code: 'PE',
    name: 'Peru',
    currencyCode: 'PEN',
    phoneCode: '+51',
    locale: 'es-PE',
  },
  {
    code: 'UY',
    name: 'Uruguay',
    currencyCode: 'UYU',
    phoneCode: '+598',
    locale: 'es-UY',
  },
  // Europe
  {
    code: 'GB',
    name: 'United Kingdom',
    currencyCode: 'GBP',
    phoneCode: '+44',
    locale: 'en-GB',
  },
  {
    code: 'DE',
    name: 'Germany',
    currencyCode: 'EUR',
    phoneCode: '+49',
    locale: 'de-DE',
  },
  {
    code: 'FR',
    name: 'France',
    currencyCode: 'EUR',
    phoneCode: '+33',
    locale: 'fr-FR',
  },
  {
    code: 'ES',
    name: 'Spain',
    currencyCode: 'EUR',
    phoneCode: '+34',
    locale: 'es-ES',
  },
  {
    code: 'IT',
    name: 'Italy',
    currencyCode: 'EUR',
    phoneCode: '+39',
    locale: 'it-IT',
  },
  {
    code: 'PT',
    name: 'Portugal',
    currencyCode: 'EUR',
    phoneCode: '+351',
    locale: 'pt-PT',
  },
  {
    code: 'NL',
    name: 'Netherlands',
    currencyCode: 'EUR',
    phoneCode: '+31',
    locale: 'nl-NL',
  },
  {
    code: 'CH',
    name: 'Switzerland',
    currencyCode: 'CHF',
    phoneCode: '+41',
    locale: 'de-CH',
  },
  {
    code: 'SE',
    name: 'Sweden',
    currencyCode: 'SEK',
    phoneCode: '+46',
    locale: 'sv-SE',
  },
  {
    code: 'NO',
    name: 'Norway',
    currencyCode: 'NOK',
    phoneCode: '+47',
    locale: 'nb-NO',
  },
  {
    code: 'DK',
    name: 'Denmark',
    currencyCode: 'DKK',
    phoneCode: '+45',
    locale: 'da-DK',
  },
  {
    code: 'PL',
    name: 'Poland',
    currencyCode: 'PLN',
    phoneCode: '+48',
    locale: 'pl-PL',
  },
  // Asia & Oceania
  {
    code: 'JP',
    name: 'Japan',
    currencyCode: 'JPY',
    phoneCode: '+81',
    locale: 'ja-JP',
  },
  {
    code: 'CN',
    name: 'China',
    currencyCode: 'CNY',
    phoneCode: '+86',
    locale: 'zh-CN',
  },
  {
    code: 'KR',
    name: 'South Korea',
    currencyCode: 'KRW',
    phoneCode: '+82',
    locale: 'ko-KR',
  },
  {
    code: 'IN',
    name: 'India',
    currencyCode: 'INR',
    phoneCode: '+91',
    locale: 'en-IN',
  },
  {
    code: 'AU',
    name: 'Australia',
    currencyCode: 'AUD',
    phoneCode: '+61',
    locale: 'en-AU',
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    currencyCode: 'NZD',
    phoneCode: '+64',
    locale: 'en-NZ',
  },
  {
    code: 'SG',
    name: 'Singapore',
    currencyCode: 'SGD',
    phoneCode: '+65',
    locale: 'en-SG',
  },
  {
    code: 'HK',
    name: 'Hong Kong',
    currencyCode: 'HKD',
    phoneCode: '+852',
    locale: 'zh-HK',
  },
  {
    code: 'TW',
    name: 'Taiwan',
    currencyCode: 'TWD',
    phoneCode: '+886',
    locale: 'zh-TW',
  },
  // Middle East & Africa
  {
    code: 'AE',
    name: 'United Arab Emirates',
    currencyCode: 'AED',
    phoneCode: '+971',
    locale: 'ar-AE',
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    currencyCode: 'SAR',
    phoneCode: '+966',
    locale: 'ar-SA',
  },
  {
    code: 'IL',
    name: 'Israel',
    currencyCode: 'ILS',
    phoneCode: '+972',
    locale: 'he-IL',
  },
  {
    code: 'ZA',
    name: 'South Africa',
    currencyCode: 'ZAR',
    phoneCode: '+27',
    locale: 'en-ZA',
  },
  {
    code: 'TR',
    name: 'Turkey',
    currencyCode: 'TRY',
    phoneCode: '+90',
    locale: 'tr-TR',
  },
];

// =============================================================================
// Reference Data: Preference Definitions
// =============================================================================

interface PreferenceDefinitionSeedData {
  category: PreferenceCategory;
  key: string;
  dataType: PreferenceDataType;
  defaultValue: unknown;
  label: string;
  description?: string;
  sortOrder: number;
}

const preferenceDefinitions: PreferenceDefinitionSeedData[] = [
  // --- DASHBOARD preferences ---
  {
    category: PreferenceCategory.DASHBOARD,
    key: 'show_total_balance',
    dataType: PreferenceDataType.BOOLEAN,
    defaultValue: true,
    label: 'Show total balance',
    description: 'Display the total balance card on the dashboard',
    sortOrder: 0,
  },
  {
    category: PreferenceCategory.DASHBOARD,
    key: 'show_activity_feed',
    dataType: PreferenceDataType.BOOLEAN,
    defaultValue: true,
    label: 'Show activity feed',
    description: 'Display recent workspace activity on the dashboard',
    sortOrder: 1,
  },
  {
    category: PreferenceCategory.DASHBOARD,
    key: 'show_usage_overview',
    dataType: PreferenceDataType.BOOLEAN,
    defaultValue: true,
    label: 'Show usage overview',
    description: 'Display workspace usage insights on the dashboard',
    sortOrder: 2,
  },
  {
    category: PreferenceCategory.DASHBOARD,
    key: 'activity_items_count',
    dataType: PreferenceDataType.NUMBER,
    defaultValue: 5,
    label: 'Activity items count',
    description:
      'Number of recent workspace activity items to show on the dashboard (3-10)',
    sortOrder: 3,
  },

  // --- APPEARANCE preferences ---
  {
    category: PreferenceCategory.APPEARANCE,
    key: 'theme',
    dataType: PreferenceDataType.STRING,
    defaultValue: 'system',
    label: 'App theme',
    description: 'Choose between light, dark, or system theme',
    sortOrder: 0,
  },
  {
    category: PreferenceCategory.APPEARANCE,
    key: 'compact_mode',
    dataType: PreferenceDataType.BOOLEAN,
    defaultValue: false,
    label: 'Compact mode',
    description: 'Use compact layout for lists and cards',
    sortOrder: 1,
  },

  // --- NOTIFICATIONS preferences ---
  {
    category: PreferenceCategory.NOTIFICATIONS,
    key: 'push_enabled',
    dataType: PreferenceDataType.BOOLEAN,
    defaultValue: true,
    label: 'Push notifications',
    description: 'Enable or disable push notifications',
    sortOrder: 0,
  },
  {
    category: PreferenceCategory.NOTIFICATIONS,
    key: 'email_weekly_summary',
    dataType: PreferenceDataType.BOOLEAN,
    defaultValue: false,
    label: 'Weekly email summary',
    description: 'Receive a weekly summary of your finances by email',
    sortOrder: 1,
  },
  {
    category: PreferenceCategory.NOTIFICATIONS,
    key: 'notify_workspace_changes',
    dataType: PreferenceDataType.BOOLEAN,
    defaultValue: true,
    label: 'Workspace change alerts',
    description: 'Get notified about relevant workspace changes and updates',
    sortOrder: 2,
  },

  // --- PRIVACY preferences ---
  {
    category: PreferenceCategory.PRIVACY,
    key: 'analytics_opt_in',
    dataType: PreferenceDataType.BOOLEAN,
    defaultValue: true,
    label: 'Usage analytics',
    description: 'Help us improve by sharing anonymous usage data',
    sortOrder: 0,
  },
  {
    category: PreferenceCategory.PRIVACY,
    key: 'hide_amounts_on_preview',
    dataType: PreferenceDataType.BOOLEAN,
    defaultValue: false,
    label: 'Hide amounts in previews',
    description: 'Hide monetary amounts in notifications and widgets',
    sortOrder: 1,
  },

  // --- REGIONAL preferences ---
  {
    category: PreferenceCategory.REGIONAL,
    key: 'date_format',
    dataType: PreferenceDataType.STRING,
    defaultValue: 'DD/MM/YYYY',
    label: 'Date format',
    description: 'Preferred date display format',
    sortOrder: 0,
  },
  {
    category: PreferenceCategory.REGIONAL,
    key: 'number_format',
    dataType: PreferenceDataType.STRING,
    defaultValue: '1,234.56',
    label: 'Number format',
    description: 'Preferred number display format',
    sortOrder: 1,
  },
  {
    category: PreferenceCategory.REGIONAL,
    key: 'first_day_of_week',
    dataType: PreferenceDataType.STRING,
    defaultValue: 'monday',
    label: 'First day of week',
    description: 'Choose which day starts your week',
    sortOrder: 2,
  },
];

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
}

const plans: PlanSeedData[] = [
  {
    code: 'free',
    name: 'Free',
    description: 'Baseline access for the platform core modules',
    priceMonthly: 0,
    isDefault: true,
    sortOrder: 0,
  },
  {
    code: 'pro',
    name: 'Pro',
    description: 'Extended access for growing workspaces',
    priceMonthly: 4.99,
    priceYearly: 49.99,
    isDefault: false,
    sortOrder: 1,
  },
  {
    code: 'premium',
    name: 'Premium',
    description: 'Highest tier with all active platform features enabled',
    priceMonthly: 9.99,
    priceYearly: 99.99,
    isDefault: false,
    sortOrder: 2,
  },
];

const features: Record<string, FeatureSeedData[]> = {
  free: [
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
      featureCode: 'ai_insights',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 0,
    },
  ],
  pro: [
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
      featureCode: 'ai_insights',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 0,
    },
  ],
  premium: [
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
      featureCode: 'ai_insights',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 1,
    },
  ],
};

async function main() {
  console.log('🌱 Starting seed...');

  // =========================================================================
  // 1. Seed Currencies (must go first — countries reference currencies)
  // =========================================================================
  console.log('\n📀 Seeding currencies...');
  for (const currencyData of currencies) {
    await prisma.currency.upsert({
      where: { code: currencyData.code },
      update: {
        name: currencyData.name,
        symbol: currencyData.symbol,
        decimalScale: currencyData.decimalScale,
        isActive: true,
      },
      create: {
        code: currencyData.code,
        name: currencyData.name,
        symbol: currencyData.symbol,
        decimalScale: currencyData.decimalScale,
        isActive: true,
      },
    });
  }
  console.log(`  ✓ ${currencies.length} currencies seeded`);

  // =========================================================================
  // 2. Seed Countries (depends on currencies)
  // =========================================================================
  console.log('\n🌍 Seeding countries...');
  for (const countryData of countries) {
    await prisma.country.upsert({
      where: { code: countryData.code },
      update: {
        name: countryData.name,
        currencyCode: countryData.currencyCode,
        phoneCode: countryData.phoneCode,
        locale: countryData.locale,
        isActive: true,
      },
      create: {
        code: countryData.code,
        name: countryData.name,
        currencyCode: countryData.currencyCode,
        phoneCode: countryData.phoneCode,
        locale: countryData.locale,
        isActive: true,
      },
    });
  }
  console.log(`  ✓ ${countries.length} countries seeded`);

  // =========================================================================
  // 3. Seed Preference Definitions
  // =========================================================================
  console.log('\n⚙️  Seeding preference definitions...');
  for (const prefData of preferenceDefinitions) {
    await prisma.preferenceDefinition.upsert({
      where: {
        category_key: {
          category: prefData.category,
          key: prefData.key,
        },
      },
      update: {
        dataType: prefData.dataType,
        defaultValue: prefData.defaultValue as object,
        label: prefData.label,
        description: prefData.description,
        sortOrder: prefData.sortOrder,
        isActive: true,
      },
      create: {
        category: prefData.category,
        key: prefData.key,
        dataType: prefData.dataType,
        defaultValue: prefData.defaultValue as object,
        label: prefData.label,
        description: prefData.description,
        sortOrder: prefData.sortOrder,
        isActive: true,
      },
    });
  }
  console.log(
    `  ✓ ${preferenceDefinitions.length} preference definitions seeded`,
  );

  // =========================================================================
  // 4. Seed Plans & Features
  // =========================================================================
  console.log('\n💳 Seeding plans...');

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
            featureType: FeatureType.RESOURCE,
            limitPeriod: null,
          },
          create: {
            planId: plan.id,
            featureCode: featureData.featureCode,
            limitType: featureData.limitType,
            limitValue: featureData.limitValue,
            featureType: FeatureType.RESOURCE,
            limitPeriod: null,
          },
        });
      }
      console.log(`    → ${planFeatures.length} features configured`);
    }
  }

  console.log('\n✅ Main seed completed successfully!');
}

main()
  .then(() => {
    console.log('\n✅ All seeds completed successfully!');
  })
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
