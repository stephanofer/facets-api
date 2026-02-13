import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { SentryModule } from '@sentry/nestjs/setup';
import { ConfigModule } from '@config/config.module';
import { DatabaseModule } from '@database/database.module';
import { HealthModule } from '@health/health.module';
import { MailModule } from '@mail/mail.module';
import { AuthModule } from '@modules/auth/auth.module';
import { SubscriptionsModule } from '@modules/subscriptions/subscriptions.module';
import { AccountsModule } from '@modules/accounts/accounts.module';
import { CategoriesModule } from '@modules/categories/categories.module';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';

@Module({
  imports: [
    // Sentry must be the first module imported
    SentryModule.forRoot(),

    // Global modules
    ConfigModule,
    DatabaseModule,
    MailModule,

    // Multi-tier rate limiting (protects all endpoints by default)
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'short', // Burst protection
          ttl: 1000, // 1 second
          limit: 3,
        },
        {
          name: 'medium', // General protection
          ttl: 60000, // 1 minute
          limit: 30,
        },
        {
          name: 'long', // Sustained abuse protection
          ttl: 3600000, // 1 hour
          limit: 500,
        },
      ],
    }),

    // In-memory cache (plans, features — near-static data)
    CacheModule.register({
      ttl: 300_000, // 5 minutes default TTL (in ms)
      isGlobal: true,
    }),

    // Feature modules
    HealthModule,
    AuthModule,
    SubscriptionsModule,
    AccountsModule,
    CategoriesModule,
  ],
  controllers: [],
  providers: [
    // Global JWT Auth Guard - all routes protected by default
    // Use @Public() decorator for public routes
    JwtAuthGuard,
    {
      provide: APP_GUARD,
      useExisting: JwtAuthGuard,
    },
    // Global rate limiting - applies to all routes
    // Use @Throttle() to override per-endpoint, @SkipThrottle() to skip
    // Registered with useExisting so it can be overridden in E2E tests
    ThrottlerGuard,
    {
      provide: APP_GUARD,
      useExisting: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
