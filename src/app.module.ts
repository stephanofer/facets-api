import { Module } from '@nestjs/common';
import { ConfigModule } from '@config/config.module';
import { DatabaseModule } from '@database/database.module';
import { HealthModule } from '@health/health.module';

@Module({
  imports: [
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
