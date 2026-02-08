import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { SentryModule } from '@sentry/nestjs/setup';
import { ConfigModule } from '@config/config.module';
import { DatabaseModule } from '@database/database.module';
import { HealthModule } from '@health/health.module';
import { MailModule } from '@mail/mail.module';
import { AuthModule } from '@modules/auth/auth.module';
import { SubscriptionsModule } from '@modules/subscriptions/subscriptions.module';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';

@Module({
  imports: [
    // Sentry must be the first module imported
    SentryModule.forRoot(),

    // Global modules
    ConfigModule,
    DatabaseModule,
    MailModule,

    // In-memory cache (plans, features — near-static data)
    CacheModule.register({
      ttl: 300_000, // 5 minutes default TTL (in ms)
      isGlobal: true,
    }),

    // Feature modules
    HealthModule,
    AuthModule,
    SubscriptionsModule,
  ],
  controllers: [],
  providers: [
    // Global JWT Auth Guard - all routes protected by default
    // Use @Public() decorator for public routes
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
