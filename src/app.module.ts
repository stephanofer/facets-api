import { Module } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { ConfigModule } from '@config/config.module';
import { DatabaseModule } from '@database/database.module';
import { HealthModule } from '@health/health.module';

@Module({
  imports: [
    // Sentry must be the first module imported
    SentryModule.forRoot(),

    // Global modules
    ConfigModule,
    DatabaseModule,

    // Feature modules
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
