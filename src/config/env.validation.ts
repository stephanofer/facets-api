import { z } from 'zod';

export const envSchema = z.object({
  // App
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('api'),
  API_VERSION: z.string().default('v1'),

  // Database
  DATABASE_URL: z.url(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  // Sentry (optional)
  SENTRY_DSN: z.string().optional(),

  // CORS
  ALLOWED_ORIGINS: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_TTL: z.coerce.number().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),

  // Mailtrap
  MAILTRAP_API_TOKEN: z.string().min(1),
  MAILTRAP_SENDER_EMAIL: z.string().email(),
  MAILTRAP_SENDER_NAME: z.string().default('Facets'),
  MAILTRAP_SANDBOX: z.coerce.boolean().default(true),
  MAILTRAP_TEST_INBOX_ID: z.coerce.number().optional(),
});

export type Env = z.infer<typeof envSchema>;
