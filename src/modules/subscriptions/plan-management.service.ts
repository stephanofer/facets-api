import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import {
  PlansRepository,
  PlanWithFeatures,
} from '@modules/subscriptions/repositories/plans.repository';
import {
  SubscriptionsRepository,
  SubscriptionWithPlan,
} from '@modules/subscriptions/repositories/subscriptions.repository';
import { PlanChangeLogRepository } from '@modules/subscriptions/repositories/plan-change-log.repository';
import { MailService } from '@mail/mail.service';
import {
  PLAN_CODES,
  FeatureCode,
  FEATURES,
} from '@modules/subscriptions/constants/features.constant';
import {
  PlanChangePreviewDto,
  ResourceOverageDto,
  UpgradeResponseDto,
  DowngradeResponseDto,
  CancelResponseDto,
  ReactivateResponseDto,
  CancelScheduledChangeResponseDto,
  PlanChangeLogDto,
} from '@modules/subscriptions/dtos/plan-management.dto';
import {
  toPlanDto,
  toDecimalNumber,
  SubscriptionDto,
} from '@modules/subscriptions/dtos/subscription.dto';
import { BusinessException } from '@common/exceptions/business.exception';
import {
  ERROR_CODES,
  SUBSCRIPTION_CONSTANTS,
} from '@common/constants/app.constants';
import {
  PlanChangeType,
  FeatureLimitType,
  FeatureType,
} from '../../generated/prisma/client';

/**
 * Service for managing plan upgrades, downgrades, cancellations, and reactivations.
 *
 * Key business rules:
 * - UPGRADE: Applied immediately (user pays more)
 * - DOWNGRADE: Scheduled for end of billing period (user already paid)
 * - CANCEL: Scheduled for end of billing period (user already paid)
 */
@Injectable()
export class PlanManagementService {
  private readonly logger = new Logger(PlanManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plansRepository: PlansRepository,
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly planChangeLogRepository: PlanChangeLogRepository,
    private readonly mailService: MailService,
  ) {}

  // ==========================================================================
  // Preview Plan Change
  // ==========================================================================

  /**
   * Preview the effects of changing to a different plan
   */
  async previewPlanChange(
    userId: string,
    targetPlanCode: string,
  ): Promise<PlanChangePreviewDto> {
    const subscription =
      await this.subscriptionsRepository.findByUserId(userId);
    if (!subscription) {
      throw new BusinessException(
        ERROR_CODES.NO_SUBSCRIPTION,
        'No active subscription found',
        HttpStatus.NOT_FOUND,
      );
    }

    const targetPlan = await this.plansRepository.findByCode(targetPlanCode);
    if (!targetPlan) {
      throw new BusinessException(
        ERROR_CODES.PLAN_NOT_FOUND,
        `Plan '${targetPlanCode}' not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Check if already on this plan
    if (subscription.plan.code === targetPlanCode) {
      throw new BusinessException(
        ERROR_CODES.ALREADY_ON_PLAN,
        'You are already on this plan',
        HttpStatus.BAD_REQUEST,
      );
    }

    const currentPlan = subscription.plan;
    const isUpgrade = targetPlan.sortOrder > currentPlan.sortOrder;

    // For downgrades, check for resource overages
    const overages: ResourceOverageDto[] = [];
    if (!isUpgrade) {
      const detectedOverages = await this.detectResourceOverages(
        userId,
        targetPlan,
      );
      overages.push(...detectedOverages);
    }

    const hasOverages = overages.length > 0;
    const effectiveAt = isUpgrade
      ? new Date()
      : (subscription.currentPeriodEnd ?? new Date());

    // Calculate grace period end if there are overages
    let gracePeriodEnd: Date | undefined;
    if (hasOverages) {
      gracePeriodEnd = new Date(effectiveAt);
      gracePeriodEnd.setDate(
        gracePeriodEnd.getDate() + SUBSCRIPTION_CONSTANTS.GRACE_PERIOD_DAYS,
      );
    }

    // Calculate proration (simplified - in production would integrate with payment provider)
    const prorationAmount = isUpgrade
      ? this.calculateProration(subscription, targetPlan)
      : undefined;

    return {
      currentPlan: toPlanDto(currentPlan),
      targetPlan: toPlanDto(targetPlan),
      changeType: isUpgrade ? 'UPGRADE' : 'DOWNGRADE',
      immediate: isUpgrade,
      effectiveAt: isUpgrade ? undefined : effectiveAt,
      prorationAmount,
      overages,
      hasOverages,
      gracePeriodEnd,
    };
  }

  // ==========================================================================
  // Upgrade Plan
  // ==========================================================================

  /**
   * Upgrade to a higher plan (immediate effect)
   */
  async upgradePlan(
    userId: string,
    targetPlanCode: string,
    userEmail: string,
    userName?: string,
  ): Promise<UpgradeResponseDto> {
    const subscription =
      await this.subscriptionsRepository.findByUserId(userId);
    if (!subscription) {
      throw new BusinessException(
        ERROR_CODES.NO_SUBSCRIPTION,
        'No active subscription found',
        HttpStatus.NOT_FOUND,
      );
    }

    const targetPlan = await this.plansRepository.findByCode(targetPlanCode);
    if (!targetPlan) {
      throw new BusinessException(
        ERROR_CODES.PLAN_NOT_FOUND,
        `Plan '${targetPlanCode}' not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Validate this is actually an upgrade
    if (subscription.plan.code === targetPlanCode) {
      throw new BusinessException(
        ERROR_CODES.ALREADY_ON_PLAN,
        'You are already on this plan',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (targetPlan.sortOrder <= subscription.plan.sortOrder) {
      throw new BusinessException(
        ERROR_CODES.NOT_AN_UPGRADE,
        'This is not an upgrade. Use the downgrade endpoint instead.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Calculate proration
    const prorationAmount = this.calculateProration(subscription, targetPlan);

    // Calculate new period end (for paid plans, 30 days from now)
    const currentPeriodEnd =
      targetPlan.code === PLAN_CODES.FREE
        ? null
        : this.calculateNextPeriodEnd();

    // Apply upgrade immediately
    const updatedSubscription = await this.subscriptionsRepository.applyUpgrade(
      userId,
      targetPlan.id,
      currentPeriodEnd,
    );

    // Log the change
    await this.planChangeLogRepository.create({
      userId,
      fromPlanId: subscription.plan.id,
      toPlanId: targetPlan.id,
      changeType: PlanChangeType.UPGRADE,
      effectiveAt: new Date(),
      prorationAmount,
    });

    // Send confirmation email
    try {
      await this.mailService.sendTemplate('plan-upgraded', userEmail, {
        userName: userName ?? 'there',
        previousPlanName: subscription.plan.name,
        newPlanName: targetPlan.name,
        newPlanPrice: this.formatPrice(targetPlan),
        effectiveDate: this.formatDate(new Date()),
      });
    } catch (error) {
      this.logger.error(
        `Failed to send upgrade email to ${userEmail}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return {
      message: `Successfully upgraded to ${targetPlan.name} plan`,
      subscription: this.toSubscriptionDto(updatedSubscription),
      prorationAmount,
    };
  }

  // ==========================================================================
  // Downgrade Plan
  // ==========================================================================

  /**
   * Downgrade to a lower plan (scheduled for end of billing period)
   */
  async downgradePlan(
    userId: string,
    targetPlanCode: string,
    userEmail: string,
    userName?: string,
  ): Promise<DowngradeResponseDto> {
    const subscription =
      await this.subscriptionsRepository.findByUserId(userId);
    if (!subscription) {
      throw new BusinessException(
        ERROR_CODES.NO_SUBSCRIPTION,
        'No active subscription found',
        HttpStatus.NOT_FOUND,
      );
    }

    const targetPlan = await this.plansRepository.findByCode(targetPlanCode);
    if (!targetPlan) {
      throw new BusinessException(
        ERROR_CODES.PLAN_NOT_FOUND,
        `Plan '${targetPlanCode}' not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Validate this is actually a downgrade
    if (subscription.plan.code === targetPlanCode) {
      throw new BusinessException(
        ERROR_CODES.ALREADY_ON_PLAN,
        'You are already on this plan',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (targetPlan.sortOrder >= subscription.plan.sortOrder) {
      throw new BusinessException(
        ERROR_CODES.NOT_A_DOWNGRADE,
        'This is not a downgrade. Use the upgrade endpoint instead.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Detect overages for the target plan
    const overages = await this.detectResourceOverages(userId, targetPlan);
    const hasOverages = overages.length > 0;

    // Determine when the downgrade will take effect
    const scheduledChangeAt = subscription.currentPeriodEnd ?? new Date();

    // Calculate grace period if there are overages
    let gracePeriodEnd: Date | undefined;
    let graceOverages: Record<string, number> | undefined;

    if (hasOverages) {
      gracePeriodEnd = new Date(scheduledChangeAt);
      gracePeriodEnd.setDate(
        gracePeriodEnd.getDate() + SUBSCRIPTION_CONSTANTS.GRACE_PERIOD_DAYS,
      );

      // Store overages for tracking
      graceOverages = {};
      for (const overage of overages) {
        graceOverages[overage.featureCode] = overage.overage;
      }
    }

    // Schedule the downgrade
    await this.subscriptionsRepository.scheduleDowngrade(
      userId,
      targetPlan.id,
      scheduledChangeAt,
      graceOverages,
      gracePeriodEnd,
    );

    // Log the scheduled change
    await this.planChangeLogRepository.create({
      userId,
      fromPlanId: subscription.plan.id,
      toPlanId: targetPlan.id,
      changeType: PlanChangeType.DOWNGRADE_SCHEDULED,
      scheduledFor: scheduledChangeAt,
      metadata: hasOverages ? { overages } : undefined,
    });

    // Send confirmation email
    try {
      await this.mailService.sendTemplate(
        'plan-downgrade-scheduled',
        userEmail,
        {
          userName: userName ?? 'there',
          currentPlanName: subscription.plan.name,
          newPlanName: targetPlan.name,
          effectiveDate: this.formatDate(scheduledChangeAt),
          overages: overages.map((o) => ({
            feature: this.formatFeatureName(o.featureCode),
            current: o.current,
            newLimit: o.newLimit,
          })),
          hasOverages,
          gracePeriodEnd: gracePeriodEnd ? this.formatDate(gracePeriodEnd) : '',
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to send downgrade email to ${userEmail}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    // Reload subscription to include current state
    const updatedSubscription =
      await this.subscriptionsRepository.findByUserId(userId);

    return {
      message: `Downgrade to ${targetPlan.name} plan scheduled for ${this.formatDate(scheduledChangeAt)}`,
      subscription: this.toSubscriptionDto(updatedSubscription!),
      scheduledFor: scheduledChangeAt,
      targetPlanCode: targetPlan.code,
      overages,
      gracePeriodEnd,
    };
  }

  // ==========================================================================
  // Cancel Subscription
  // ==========================================================================

  /**
   * Cancel subscription (scheduled for end of billing period, reverts to FREE)
   */
  async cancelSubscription(
    userId: string,
    reason: string | undefined,
    userEmail: string,
    userName?: string,
  ): Promise<CancelResponseDto> {
    const subscription =
      await this.subscriptionsRepository.findByUserId(userId);
    if (!subscription) {
      throw new BusinessException(
        ERROR_CODES.NO_SUBSCRIPTION,
        'No active subscription found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Cannot cancel FREE plan
    if (subscription.plan.code === PLAN_CODES.FREE) {
      throw new BusinessException(
        ERROR_CODES.CANNOT_CANCEL_FREE_PLAN,
        'Cannot cancel a free plan',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if already cancelled
    if (subscription.cancelledAt) {
      throw new BusinessException(
        ERROR_CODES.SUBSCRIPTION_ALREADY_CANCELLED,
        'Subscription is already cancelled',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Get the FREE plan for downgrade
    const freePlan = await this.plansRepository.findByCode(PLAN_CODES.FREE);
    if (!freePlan) {
      throw new BusinessException(
        ERROR_CODES.PLAN_NOT_FOUND,
        'Free plan not found',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Schedule cancellation for end of billing period
    const effectiveAt = subscription.currentPeriodEnd ?? new Date();

    await this.subscriptionsRepository.scheduleCancellation(
      userId,
      freePlan.id,
      effectiveAt,
      reason,
    );

    // Log the cancellation
    await this.planChangeLogRepository.create({
      userId,
      fromPlanId: subscription.plan.id,
      toPlanId: freePlan.id,
      changeType: PlanChangeType.CANCELLATION,
      scheduledFor: effectiveAt,
      reason,
    });

    // Send confirmation email
    try {
      await this.mailService.sendTemplate('subscription-cancelled', userEmail, {
        userName: userName ?? 'there',
        currentPlanName: subscription.plan.name,
        effectiveDate: this.formatDate(effectiveAt),
      });
    } catch (error) {
      this.logger.error(
        `Failed to send cancellation email to ${userEmail}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return {
      message: 'Subscription cancellation scheduled',
      cancelledAt: new Date(),
      effectiveAt,
    };
  }

  // ==========================================================================
  // Reactivate Subscription
  // ==========================================================================

  /**
   * Reactivate a cancelled subscription (remove scheduled cancellation)
   */
  async reactivateSubscription(userId: string): Promise<ReactivateResponseDto> {
    const subscription =
      await this.subscriptionsRepository.findByUserId(userId);
    if (!subscription) {
      throw new BusinessException(
        ERROR_CODES.NO_SUBSCRIPTION,
        'No active subscription found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Check if there's a pending cancellation
    if (!subscription.cancelledAt) {
      throw new BusinessException(
        ERROR_CODES.NO_PENDING_CANCELLATION,
        'No pending cancellation to reactivate',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Reactivate
    const updatedSubscription =
      await this.subscriptionsRepository.reactivate(userId);

    // Log the reactivation
    await this.planChangeLogRepository.create({
      userId,
      fromPlanId: subscription.plan.id,
      toPlanId: subscription.plan.id,
      changeType: PlanChangeType.REACTIVATION,
      effectiveAt: new Date(),
    });

    return {
      message: 'Subscription reactivated successfully',
      subscription: this.toSubscriptionDto(updatedSubscription),
    };
  }

  // ==========================================================================
  // Cancel Scheduled Change
  // ==========================================================================

  /**
   * Cancel a scheduled downgrade (not cancellation - use reactivate for that)
   */
  async cancelScheduledChange(
    userId: string,
  ): Promise<CancelScheduledChangeResponseDto> {
    const subscription =
      await this.subscriptionsRepository.findByUserIdWithScheduledPlan(userId);
    if (!subscription) {
      throw new BusinessException(
        ERROR_CODES.NO_SUBSCRIPTION,
        'No active subscription found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Check if there's a scheduled change
    if (!subscription.scheduledPlanId) {
      throw new BusinessException(
        ERROR_CODES.NO_SCHEDULED_CHANGE,
        'No scheduled plan change to cancel',
        HttpStatus.BAD_REQUEST,
      );
    }

    // If it's a cancellation, redirect to reactivate
    if (subscription.cancelledAt) {
      throw new BusinessException(
        ERROR_CODES.SUBSCRIPTION_ALREADY_CANCELLED,
        'Use the reactivate endpoint to undo a cancellation',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Cancel the scheduled change
    const updatedSubscription =
      await this.subscriptionsRepository.cancelScheduledChange(userId);

    return {
      message: 'Scheduled change cancelled successfully',
      subscription: this.toSubscriptionDto(updatedSubscription),
    };
  }

  // ==========================================================================
  // Get Plan Change History
  // ==========================================================================

  /**
   * Get plan change history for a user
   */
  async getPlanChangeHistory(
    userId: string,
    limit: number = 20,
  ): Promise<PlanChangeLogDto[]> {
    const logs = await this.planChangeLogRepository.findByUserId(userId, limit);

    return logs.map((log) => ({
      id: log.id,
      fromPlanCode: log.fromPlan.code,
      fromPlanName: log.fromPlan.name,
      toPlanCode: log.toPlan.code,
      toPlanName: log.toPlan.name,
      changeType: log.changeType,
      requestedAt: log.requestedAt,
      effectiveAt: log.effectiveAt ?? undefined,
      scheduledFor: log.scheduledFor ?? undefined,
      prorationAmount: log.prorationAmount
        ? Number(log.prorationAmount)
        : undefined,
      reason: log.reason ?? undefined,
    }));
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Detect resources that would exceed limits on a target plan
   */
  private async detectResourceOverages(
    userId: string,
    targetPlan: PlanWithFeatures,
  ): Promise<ResourceOverageDto[]> {
    const overages: ResourceOverageDto[] = [];

    // Get current resource counts for each RESOURCE feature
    const resourceFeatures = targetPlan.planFeatures.filter(
      (f) =>
        f.featureType === FeatureType.RESOURCE &&
        f.limitType === FeatureLimitType.COUNT,
    );

    for (const feature of resourceFeatures) {
      const currentCount = await this.getResourceCount(
        userId,
        feature.featureCode as FeatureCode,
      );

      if (currentCount > feature.limitValue) {
        overages.push({
          featureCode: feature.featureCode,
          current: currentCount,
          newLimit: feature.limitValue,
          overage: currentCount - feature.limitValue,
          hasGracePeriod: this.featureHasGracePeriod(feature.featureCode),
        });
      }
    }

    return overages;
  }

  /**
   * Get current count of resources for a feature
   *
   * NOTE: This method returns 0 for all resource features until the corresponding
   * feature modules (accounts, goals, debts, loans, categories, recurring) are implemented.
   * Once those modules exist, this method should be updated to query the actual counts.
   *
   * TODO: Implement actual resource counting when feature modules are built:
   * - ACCOUNTS: prisma.account.count({ where: { userId, deletedAt: null } })
   * - GOALS: prisma.goal.count({ where: { userId, deletedAt: null } })
   * - DEBTS: prisma.debt.count({ where: { userId, deletedAt: null } })
   * - LOANS: prisma.loan.count({ where: { userId, deletedAt: null } })
   * - CUSTOM_CATEGORIES: prisma.category.count({ where: { userId, isCustom: true, deletedAt: null } })
   * - RECURRING_PAYMENTS: prisma.recurringPayment.count({ where: { userId, deletedAt: null } })
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  private async getResourceCount(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _featureCode: FeatureCode,
  ): Promise<number> {
    // Return 0 until feature modules are implemented
    // This allows plan management to work without blocking on feature development
    return 0;
  }

  /**
   * Check if a feature has a grace period (vs soft limit)
   *
   * Features with grace period: User gets X days to reduce resources before losing access
   * Features with soft limit: User can't create new, but keeps existing
   */
  private featureHasGracePeriod(featureCode: string): boolean {
    // Goals and categories get grace period, others are soft limited
    const gracePeriodFeatures: readonly string[] = [
      FEATURES.GOALS,
      FEATURES.CUSTOM_CATEGORIES,
    ];
    return gracePeriodFeatures.includes(featureCode);
  }

  /**
   * Calculate proration amount for an upgrade
   */
  private calculateProration(
    subscription: SubscriptionWithPlan,
    targetPlan: PlanWithFeatures,
  ): number {
    // If no period end, no proration needed
    if (!subscription.currentPeriodEnd) {
      return 0;
    }

    const now = new Date();
    const periodEnd = subscription.currentPeriodEnd;
    const periodStart = subscription.currentPeriodStart;

    // Calculate days remaining in current period
    const totalDays = Math.ceil(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    const daysRemaining = Math.ceil(
      (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysRemaining <= 0 || totalDays <= 0) {
      return 0;
    }

    // Calculate credit for unused time on current plan
    const currentMonthlyPrice =
      toDecimalNumber(subscription.plan.priceMonthly) ?? 0;
    const dailyRateCurrent = currentMonthlyPrice / 30;
    const creditAmount = dailyRateCurrent * daysRemaining;

    // Calculate charge for remaining time on new plan
    const newMonthlyPrice = toDecimalNumber(targetPlan.priceMonthly) ?? 0;
    const dailyRateNew = newMonthlyPrice / 30;
    const chargeAmount = dailyRateNew * daysRemaining;

    // Return the difference (positive = credit, negative = charge)
    return Math.round((creditAmount - chargeAmount) * 100) / 100;
  }

  /**
   * Calculate the next billing period end date
   */
  private calculateNextPeriodEnd(): Date {
    const date = new Date();
    date.setDate(date.getDate() + SUBSCRIPTION_CONSTANTS.BILLING_PERIOD_DAYS);
    return date;
  }

  /**
   * Format plan price for display
   */
  private formatPrice(plan: PlanWithFeatures): string {
    const price = toDecimalNumber(plan.priceMonthly) ?? 0;
    if (price === 0) return 'Free';
    return `$${price.toFixed(2)}/${plan.priceCurrency === 'USD' ? 'month' : plan.priceCurrency}`;
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Format feature code to human-readable name
   */
  private formatFeatureName(featureCode: string): string {
    return featureCode
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Convert subscription entity to DTO
   */
  private toSubscriptionDto(
    subscription: SubscriptionWithPlan,
  ): SubscriptionDto {
    return {
      id: subscription.id,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd ?? undefined,
      trialStart: subscription.trialStart ?? undefined,
      trialEnd: subscription.trialEnd ?? undefined,
      plan: toPlanDto(subscription.plan),
    };
  }
}
