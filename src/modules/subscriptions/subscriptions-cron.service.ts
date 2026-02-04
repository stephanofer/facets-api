import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@database/prisma.service';
import {
  SubscriptionsRepository,
  SubscriptionWithScheduledPlan,
} from '@modules/subscriptions/repositories/subscriptions.repository';
import { PlanChangeLogRepository } from '@modules/subscriptions/repositories/plan-change-log.repository';
import { MailService } from '@mail/mail.service';
import { PLAN_CODES } from '@modules/subscriptions/constants/features.constant';
import { SUBSCRIPTION_CONSTANTS } from '@common/constants/app.constants';
import { PlanChangeType, Prisma } from '../../generated/prisma/client';

/**
 * Cron service for managing scheduled subscription changes
 *
 * Handles:
 * - Applying scheduled downgrades/cancellations at end of billing period
 * - Sending grace period warnings before expiration
 * - Handling expired grace periods (block new resource creation)
 */
@Injectable()
export class SubscriptionsCronService {
  private readonly logger = new Logger(SubscriptionsCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly planChangeLogRepository: PlanChangeLogRepository,
    private readonly mailService: MailService,
  ) {}

  // ==========================================================================
  // Scheduled Plan Changes (Downgrades/Cancellations)
  // ==========================================================================

  /**
   * Apply scheduled plan changes (downgrades and cancellations)
   *
   * Runs every hour to check for subscriptions where:
   * - scheduledChangeAt has passed
   * - scheduledPlanId is set
   *
   * @cron Every hour at minute 0
   */
  @Cron(CronExpression.EVERY_HOUR)
  async applyScheduledPlanChanges(): Promise<void> {
    this.logger.log('Starting scheduled plan changes job');

    try {
      const dueSubscriptions =
        await this.subscriptionsRepository.findDueScheduledChanges();

      if (dueSubscriptions.length === 0) {
        this.logger.debug('No scheduled plan changes due');
        return;
      }

      this.logger.log(
        `Found ${dueSubscriptions.length} subscriptions with due scheduled changes`,
      );

      for (const subscription of dueSubscriptions) {
        await this.processScheduledChange(subscription);
      }

      this.logger.log(
        `Completed processing ${dueSubscriptions.length} scheduled changes`,
      );
    } catch (error) {
      this.logger.error('Error in scheduled plan changes job', error);
    }
  }

  /**
   * Process a single scheduled change (downgrade or cancellation)
   */
  private async processScheduledChange(
    subscription: SubscriptionWithScheduledPlan,
  ): Promise<void> {
    const { userId, plan: currentPlan, scheduledPlan } = subscription;

    if (!scheduledPlan) {
      this.logger.warn(
        `Subscription ${subscription.id} has no scheduled plan, skipping`,
      );
      return;
    }

    this.logger.log(
      `Applying scheduled change for user ${userId}: ${currentPlan.code} -> ${scheduledPlan.code}`,
    );

    try {
      // Determine if this is a cancellation (to free) or regular downgrade
      const isCancellation = scheduledPlan.code === PLAN_CODES.FREE;
      const changeType = isCancellation
        ? PlanChangeType.CANCELLATION_APPLIED
        : PlanChangeType.DOWNGRADE_APPLIED;

      // Calculate new period end (null for free plan, +30 days for paid)
      const currentPeriodEnd = this.calculateNewPeriodEnd(scheduledPlan.code);

      // Check for resource overages that need grace period
      const graceOverages = await this.detectOverages(userId, scheduledPlan);
      const gracePeriodEnd =
        Object.keys(graceOverages).length > 0
          ? this.calculateGracePeriodEnd()
          : undefined;

      // Apply the change
      await this.subscriptionsRepository.applyScheduledChange(
        userId,
        scheduledPlan.id,
        currentPeriodEnd,
        Object.keys(graceOverages).length > 0 ? graceOverages : undefined,
        gracePeriodEnd,
      );

      // Log the change
      await this.planChangeLogRepository.create({
        userId,
        fromPlanId: currentPlan.id,
        toPlanId: scheduledPlan.id,
        changeType,
        effectiveAt: new Date(),
        metadata: {
          hadOverages: Object.keys(graceOverages).length > 0,
          overages: graceOverages,
        },
      });

      // Fetch user for email
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true },
      });

      if (user) {
        // Send appropriate notification email
        if (isCancellation) {
          await this.sendCancellationAppliedEmail(
            user.email,
            user.firstName,
            currentPlan.name,
          );
        } else {
          await this.sendDowngradeAppliedEmail(
            user.email,
            user.firstName,
            currentPlan.name,
            scheduledPlan.name,
            Object.keys(graceOverages).length > 0,
            gracePeriodEnd,
          );
        }
      }

      this.logger.log(`Successfully applied ${changeType} for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to apply scheduled change for user ${userId}`,
        error,
      );
    }
  }

  // ==========================================================================
  // Grace Period Handling
  // ==========================================================================

  /**
   * Handle grace period warnings and expirations
   *
   * Runs daily to:
   * 1. Send warnings 2 days before grace period expires
   * 2. Clear expired grace periods
   *
   * @cron Every day at 9:00 AM
   */
  @Cron('0 9 * * *')
  async handleGracePeriods(): Promise<void> {
    this.logger.log('Starting grace period handling job');

    try {
      await this.sendGracePeriodWarnings();
      await this.handleExpiredGracePeriods();
    } catch (error) {
      this.logger.error('Error in grace period handling job', error);
    }
  }

  /**
   * Send warnings for grace periods expiring soon (2 days before)
   */
  private async sendGracePeriodWarnings(): Promise<void> {
    const warningDays = 2;
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + warningDays);

    // Find subscriptions with grace periods expiring in ~2 days
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        gracePeriodEnd: {
          gte: new Date(),
          lte: warningDate,
        },
        graceOverages: { not: Prisma.AnyNull },
      },
      include: {
        user: { select: { email: true, firstName: true } },
        plan: true,
      },
    });

    if (subscriptions.length === 0) {
      this.logger.debug('No grace period warnings to send');
      return;
    }

    this.logger.log(
      `Sending grace period warnings to ${subscriptions.length} users`,
    );

    for (const subscription of subscriptions) {
      if (!subscription.user) continue;

      try {
        const overages = this.parseOverages(subscription.graceOverages);

        await this.mailService.sendTemplate(
          'grace-period-warning',
          subscription.user.email,
          {
            userName: subscription.user.firstName,
            gracePeriodEnd: this.formatDate(subscription.gracePeriodEnd!),
            daysRemaining: warningDays,
            overages: overages,
          },
        );

        this.logger.debug(
          `Sent grace period warning to ${subscription.user.email}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send grace period warning to ${subscription.user.email}`,
          error,
        );
      }
    }
  }

  /**
   * Handle expired grace periods
   *
   * When grace period expires:
   * - Clear the grace period flags
   * - User can no longer create new resources in overage categories
   * - Existing resources are preserved (soft limit strategy)
   */
  private async handleExpiredGracePeriods(): Promise<void> {
    const expiredSubscriptions =
      await this.subscriptionsRepository.findExpiredGracePeriods();

    if (expiredSubscriptions.length === 0) {
      this.logger.debug('No expired grace periods to handle');
      return;
    }

    this.logger.log(
      `Handling ${expiredSubscriptions.length} expired grace periods`,
    );

    for (const subscription of expiredSubscriptions) {
      try {
        const overages = this.parseOverages(subscription.graceOverages);

        // Clear the grace period
        await this.subscriptionsRepository.clearGracePeriod(
          subscription.userId,
        );

        // Fetch user for notification
        const user = await this.prisma.user.findUnique({
          where: { id: subscription.userId },
          select: { email: true, firstName: true },
        });

        if (user) {
          await this.mailService.sendTemplate(
            'grace-period-expired',
            user.email,
            {
              userName: user.firstName,
              overages: overages,
            },
          );
        }

        this.logger.log(
          `Cleared expired grace period for user ${subscription.userId}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to handle expired grace period for user ${subscription.userId}`,
          error,
        );
      }
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Parse graceOverages JSON into the expected array format
   */
  private parseOverages(
    graceOverages: Prisma.JsonValue,
  ): Array<{ feature: string; current: number; limit: number }> {
    if (!graceOverages || typeof graceOverages !== 'object') {
      return [];
    }

    const overagesObj = graceOverages as Record<
      string,
      { current: number; limit: number } | number
    >;

    return Object.entries(overagesObj).map(([feature, value]) => {
      // Handle both formats: { current, limit } or just number
      if (typeof value === 'object' && value !== null) {
        return { feature, current: value.current, limit: value.limit };
      }
      // If just a number, treat it as current count with unknown limit
      return { feature, current: value, limit: 0 };
    });
  }

  /**
   * Detect resource overages when downgrading to a new plan
   *
   * Returns a map of feature code -> overage count
   *
   * NOTE: Returns empty object until feature modules are implemented
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  private async detectOverages(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _targetPlan: {
      planFeatures: Array<{ featureCode: string; limitValue: number }>;
    },
  ): Promise<Record<string, number>> {
    // TODO: Implement actual overage detection when feature modules exist
    // For now, return empty (no overages) since we can't count resources yet
    return {};
  }

  /**
   * Calculate the new billing period end date
   */
  private calculateNewPeriodEnd(planCode: string): Date | null {
    // Free plan has no period end
    if (planCode === PLAN_CODES.FREE) {
      return null;
    }

    // Paid plans have 30-day billing periods
    const periodEnd = new Date();
    periodEnd.setDate(
      periodEnd.getDate() + SUBSCRIPTION_CONSTANTS.BILLING_PERIOD_DAYS,
    );
    return periodEnd;
  }

  /**
   * Calculate grace period end date (7 days from now)
   */
  private calculateGracePeriodEnd(): Date {
    const gracePeriodEnd = new Date();
    gracePeriodEnd.setDate(
      gracePeriodEnd.getDate() + SUBSCRIPTION_CONSTANTS.GRACE_PERIOD_DAYS,
    );
    return gracePeriodEnd;
  }

  /**
   * Format a date for email display
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Send email notification when cancellation is applied
   */
  private async sendCancellationAppliedEmail(
    email: string,
    userName: string,
    previousPlanName: string,
  ): Promise<void> {
    try {
      await this.mailService.sendTemplate('subscription-cancelled', email, {
        userName,
        currentPlanName: previousPlanName,
        effectiveDate: this.formatDate(new Date()),
      });
    } catch (error) {
      this.logger.error(
        `Failed to send cancellation applied email to ${email}`,
        error,
      );
    }
  }

  /**
   * Send email notification when downgrade is applied
   */
  private async sendDowngradeAppliedEmail(
    email: string,
    userName: string,
    previousPlanName: string,
    newPlanName: string,
    hasOverages: boolean,
    gracePeriodEnd?: Date,
  ): Promise<void> {
    try {
      await this.mailService.sendTemplate('plan-downgrade-scheduled', email, {
        userName,
        currentPlanName: previousPlanName,
        newPlanName,
        effectiveDate: this.formatDate(new Date()),
        hasOverages,
        gracePeriodEnd: gracePeriodEnd ? this.formatDate(gracePeriodEnd) : '',
        overages: [], // No detailed overages in this notification
      });
    } catch (error) {
      this.logger.error(
        `Failed to send downgrade applied email to ${email}`,
        error,
      );
    }
  }
}
