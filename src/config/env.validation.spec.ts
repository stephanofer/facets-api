import { envSchema } from '@config/env.validation';

describe('envSchema (AI config)', () => {
  const validEnv = {
    NODE_ENV: 'test',
    PORT: '3000',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/facets',
    JWT_ACCESS_SECRET: 'access-secret-access-secret-123456',
    JWT_REFRESH_SECRET: 'refresh-secret-refresh-secret-1234',
    JWT_ACCESS_EXPIRES: '1h',
    JWT_REFRESH_EXPIRES: '7d',
    BCRYPT_ROUNDS: '12',
    APP_URL: 'http://localhost:3000',
    WEB_URL: 'http://localhost:8081',
    CORS_ALLOWED_ORIGINS: 'http://localhost:8081',
    MAILTRAP_API_TOKEN: 'mailtrap-token',
    MAILTRAP_SENDER_EMAIL: 'noreply@example.com',
    MAILTRAP_SENDER_NAME: 'Facets',
    R2_ACCOUNT_ID: 'account-id',
    R2_ACCESS_KEY_ID: 'access-key',
    R2_SECRET_ACCESS_KEY: 'secret-key',
    R2_PUBLIC_BUCKET: 'public-bucket',
    R2_PRIVATE_BUCKET: 'private-bucket',
    R2_PUBLIC_URL: 'https://cdn.example.com',
    AI_GATEWAY_ACCOUNT_ID: 'ai-account',
    AI_GATEWAY_ID: 'gateway-id',
    AI_GATEWAY_API_TOKEN: 'ai-token',
    AI_REQUEST_TIMEOUT_MS: '30000',
    AI_METADATA_ENVIRONMENT: 'test',
  };

  it('should accept valid AI configuration', () => {
    const result = envSchema.parse(validEnv);

    expect(result.AI_GATEWAY_ACCOUNT_ID).toBe('ai-account');
    expect(result.AI_GATEWAY_ID).toBe('gateway-id');
    expect(result.AI_GATEWAY_API_TOKEN).toBe('ai-token');
  });

  it('should reject missing required AI configuration', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      AI_GATEWAY_ACCOUNT_ID: undefined,
      AI_GATEWAY_ID: undefined,
      AI_GATEWAY_API_TOKEN: undefined,
    });

    expect(result.success).toBe(false);
  });

  it('should reject invalid AI timeout values', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      AI_REQUEST_TIMEOUT_MS: '0',
    });

    expect(result.success).toBe(false);
  });
});
