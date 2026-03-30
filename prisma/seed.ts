import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  PrismaClient,
  WorkspaceStatus,
  WorkspaceType,
} from '../src/generated/prisma/client';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const currencies = [
  { code: 'USD', name: 'US Dollar', symbol: '$', decimalScale: 2 },
  { code: 'ARS', name: 'Argentine Peso', symbol: '$', decimalScale: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimalScale: 2 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimalScale: 2 },
] as const;

const countries = [
  {
    code: 'US',
    name: 'United States',
    currencyCode: 'USD',
    phoneCode: '+1',
    locale: 'en-US',
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
] as const;

const demoWorkspace = {
  slug: 'demo-workspace',
  name: 'Demo Workspace',
  displayLabel: 'Demo Workspace',
  contentLocale: 'en-US',
  financialTimezone: 'UTC',
  baseCurrencyCode: 'USD',
};

async function seedReferenceData(): Promise<void> {
  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: { ...currency, isActive: true },
      create: { ...currency, isActive: true },
    });
  }

  for (const country of countries) {
    await prisma.country.upsert({
      where: { code: country.code },
      update: { ...country, isActive: true },
      create: { ...country, isActive: true },
    });
  }
}

async function seedDemoWorkspace(): Promise<void> {
  const workspace = await prisma.workspace.upsert({
    where: { slug: demoWorkspace.slug },
    update: {
      name: demoWorkspace.name,
      type: WorkspaceType.PERSONAL,
      status: WorkspaceStatus.ACTIVE,
    },
    create: {
      slug: demoWorkspace.slug,
      name: demoWorkspace.name,
      type: WorkspaceType.PERSONAL,
      status: WorkspaceStatus.ACTIVE,
    },
  });

  await prisma.workspaceSettings.upsert({
    where: { workspaceId: workspace.id },
    update: {
      baseCurrencyCode: demoWorkspace.baseCurrencyCode,
      contentLocale: demoWorkspace.contentLocale,
      dateFormat: 'DD/MM/YYYY',
      financialTimezone: demoWorkspace.financialTimezone,
      monthStartDay: 1,
      weekStartDay: 1,
      displayLabel: demoWorkspace.displayLabel,
    },
    create: {
      workspaceId: workspace.id,
      baseCurrencyCode: demoWorkspace.baseCurrencyCode,
      contentLocale: demoWorkspace.contentLocale,
      dateFormat: 'DD/MM/YYYY',
      financialTimezone: demoWorkspace.financialTimezone,
      monthStartDay: 1,
      weekStartDay: 1,
      displayLabel: demoWorkspace.displayLabel,
    },
  });
}

async function main(): Promise<void> {
  console.log('🌱 Seeding current-schema baseline...');

  await seedReferenceData();
  await seedDemoWorkspace();

  console.log('✅ Seed completed successfully');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
