import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PlansController } from '@modules/subscriptions/plans.controller';
import { SubscriptionsController } from '@modules/subscriptions/subscriptions.controller';
import { SubscriptionsService } from '@modules/subscriptions/subscriptions.service';
import { PlanManagementService } from '@modules/subscriptions/plan-management.service';
import { SubscriptionsCronService } from '@modules/subscriptions/subscriptions-cron.service';
import { PlansRepository } from '@modules/subscriptions/repositories/plans.repository';
import { SubscriptionsRepository } from '@modules/subscriptions/repositories/subscriptions.repository';
import { UsageRepository } from '@modules/subscriptions/repositories/usage.repository';
import { PlanChangeLogRepository } from '@modules/subscriptions/repositories/plan-change-log.repository';
import { MailModule } from '@mail/mail.module';

@Module({
  imports: [ScheduleModule.forRoot(), MailModule],
  controllers: [PlansController, SubscriptionsController],
  providers: [
    // Services
    SubscriptionsService,
    PlanManagementService,
    SubscriptionsCronService,
    // Repositories
    PlansRepository,
    SubscriptionsRepository,
    UsageRepository,
    PlanChangeLogRepository,
  ],
  exports: [SubscriptionsService, PlanManagementService],
})
export class SubscriptionsModule {}
