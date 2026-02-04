import 'dotenv/config';

import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const isProduction = process.env.NODE_ENV === 'production';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  enabled: !!process.env.SENTRY_DSN,

  // Release tracking
  release: `facets-api@${process.env.npm_package_version || '0.0.1'}`,

  // Integrations
  integrations: [nodeProfilingIntegration()],

  // Performance monitoring
  // Production: 10% of transactions | Development: 100%
  tracesSampleRate: isProduction ? 0.1 : 1.0,

  // Profiling configuration
  // Production: 10% of sessions | Development: 100%
  profileSessionSampleRate: isProduction ? 0.1 : 1.0,
  profileLifecycle: 'trace',
});
