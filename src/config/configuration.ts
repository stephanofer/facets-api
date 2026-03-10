export const configuration = () => {
  const apiPrefix = process.env.API_PREFIX || 'api';
  const apiVersion = process.env.API_VERSION || 'v1';

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    api: {
      prefix: apiPrefix,
      version: apiVersion,
    },
    database: {
      url: process.env.DATABASE_URL,
    },
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
      accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
      refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
    },
    sentry: {
      dsn: process.env.SENTRY_DSN,
    },
    cors: {
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [],
    },
    rateLimit: {
      ttl: parseInt(process.env.RATE_LIMIT_TTL || '60000', 10),
      max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    },
    mail: {
      apiToken: process.env.MAILTRAP_API_TOKEN,
      senderEmail: process.env.MAILTRAP_SENDER_EMAIL,
      senderName: process.env.MAILTRAP_SENDER_NAME || 'Facets',
      sandbox: process.env.MAILTRAP_SANDBOX === 'true',
      testInboxId: process.env.MAILTRAP_TEST_INBOX_ID
        ? parseInt(process.env.MAILTRAP_TEST_INBOX_ID, 10)
        : undefined,
    },
    cookie: {
      refreshTokenPath: `/${apiPrefix}/v${apiVersion}/auth/refresh`,
    },
    storage: {
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      publicBucket: process.env.R2_PUBLIC_BUCKET,
      privateBucket: process.env.R2_PRIVATE_BUCKET,
      publicUrl: process.env.R2_PUBLIC_URL,
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    },
    ai: {
      accountId: process.env.AI_GATEWAY_ACCOUNT_ID,
      gatewayId: process.env.AI_GATEWAY_ID,
      apiToken: process.env.AI_GATEWAY_API_TOKEN,
      requestTimeoutMs: parseInt(
        process.env.AI_REQUEST_TIMEOUT_MS || '30000',
        10,
      ),
      metadataEnvironment:
        process.env.AI_METADATA_ENVIRONMENT ||
        process.env.NODE_ENV ||
        'development',
      baseUrl: `https://gateway.ai.cloudflare.com/v1/${process.env.AI_GATEWAY_ACCOUNT_ID}/${process.env.AI_GATEWAY_ID}/compat`,
    },
  };
};

export type Configuration = ReturnType<typeof configuration>;
