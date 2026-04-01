import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { SentryModule } from '@sentry/nestjs/setup';
import { ConfigModule } from '@config/config.module';
import { DatabaseModule } from '@database/database.module';
import { AiModule } from '@ai/ai.module';
import { HealthModule } from '@health/health.module';
import { MailModule } from '@mail/mail.module';
import { StorageModule } from '@storage/storage.module';
import { AuthModule } from '@modules/auth/auth.module';
import { VoucherAnalyzerModule } from '@modules/voucher-analyzer/voucher-analyzer.module';
import { WorkspacesModule } from '@modules/workspaces/workspaces.module';
import { ActiveMembershipGuard } from '@common/guards/active-membership.guard';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { PlatformRoleGuard } from '@common/guards/platform-role.guard';
import { WorkspaceRoleGuard } from '@common/guards/workspace-role.guard';

@Module({
  imports: [
    // Sentry must be the first module imported
    SentryModule.forRoot(),

    // Global modules
    ConfigModule,
    DatabaseModule,
    MailModule,
    StorageModule,
    AiModule,

    // In-memory cache for shared application data
    CacheModule.register({
      ttl: 300_000, // 5 minutes default TTL (in ms)
      isGlobal: true,
    }),

    // Feature modules
    HealthModule,
    AuthModule,
    WorkspacesModule,
    VoucherAnalyzerModule,
  ],
  controllers: [],
  providers: [
    // Global JWT Auth Guard - all routes protected by default
    // Use @Public() decorator for public routes
    JwtAuthGuard,
    PlatformRoleGuard,
    ActiveMembershipGuard,
    WorkspaceRoleGuard,
    {
      provide: APP_GUARD,
      useExisting: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: PlatformRoleGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: ActiveMembershipGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: WorkspaceRoleGuard,
    },
  ],
})
export class AppModule {}
