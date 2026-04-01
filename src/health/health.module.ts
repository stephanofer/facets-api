import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from '@health/health.controller';
import { PrismaHealthIndicator } from '@health/prisma-health.indicator';
import { HealthStateService } from '@health/health-state.service';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator, HealthStateService],
})
export class HealthModule {}
