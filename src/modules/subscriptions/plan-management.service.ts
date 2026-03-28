import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  SUBSCRIPTION_CONSTANTS,
  ERROR_CODES,
} from '@common/constants/app.constants';
import { BusinessException } from '@common/exceptions/business.exception';
import { MailService } from '@mail/mail.service';
import {
  FEATURES,
  FeatureCode,
  PLAN_CODES,
} from '@modules/subscriptions/constants/features.constant';
import {
  CancelResponseDto,
  CancelScheduledChangeResponseDto,
  DowngradeResponseDto,
  PlanChangeLogDto,
  PlanChangePreviewDto,
  ReactivateResponseDto,
  ResourceOverageDto,
  UpgradeResponseDto,
} from '@modules/subscriptions/dtos/plan-management.dto';
import {
  SubscriptionDto,
  toDecimalNumber,
  toPlanDto,
} from '@modules/subscriptions/dtos/subscription.dto';
import { PlanChangeLogRepository } from '@modules/subscriptions/repositories/plan-change-log.repository';
import {
  PlanWithFeatures,
  PlansRepository,
} from '@modules/subscriptions/repositories/plans.repository';
import {
  SubscriptionWithPlan,
  SubscriptionsRepository,
} from '@modules/subscriptions/repositories/subscriptions.repository';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import {
  FeatureLimitType,
  FeatureType,
  PlanChangeType,
  WorkspaceRole,
} from '../../generated/prisma/client';

@Injectable()
export class PlanManagementService {
  private readonly logger = new Logger(PlanManagementService.name);

  constructor(
    private readonly plansRepository: PlansRepository,
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly planChangeLogRepository: PlanChangeLogRepository,
    private readonly mailService: MailService,
  ) {}

  async previewPlanChange(
    principal: AuthenticatedPrincipal,
    targetPlanCode: string,
  ): Promise<PlanChangePreviewDto> {
    const workspaceId = this.assertBillingAdmin(principal);
    const subscription =
      await this.subscriptionsRepository.findByWorkspaceId(workspaceId);

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

    if (subscription.plan.code === targetPlanCode) {
      throw new BusinessException(
        ERROR_CODES.ALREADY_ON_PLAN,
        'You are already on this plan',
        HttpStatus.BAD_REQUEST,
      );
    }

    const currentPlan = subscription.plan;
    const isUpgrade = targetPlan.sortOrder > currentPlan.sortOrder;

    const overages = isUpgrade
      ? []
      : await this.detectResourceOverages(workspaceId, targetPlan);

    const hasOverages = overages.length > 0;
    const effectiveAt = isUpgrade
      ? new Date()
      : (subscription.currentPeriodEnd ?? new Date());

    let gracePeriodEnd: Date | undefined;
    if (hasOverages) {
      gracePeriodEnd = new Date(effectiveAt);
      gracePeriodEnd.setDate(
        gracePeriodEnd.getDate() + SUBSCRIPTION_CONSTANTS.GRACE_PERIOD_DAYS,
      );
    }

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

  async upgradePlan(
    principal: AuthenticatedPrincipal,
    targetPlanCode: string,
  ): Promise<UpgradeResponseDto> {
    const workspaceId = this.assertBillingAdmin(principal);
    const subscription =
      await this.subscriptionsRepository.findByWorkspaceId(workspaceId);

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

    const prorationAmount = this.calculateProration(subscription, targetPlan);
    const currentPeriodEnd =
      targetPlan.code === PLAN_CODES.FREE
        ? null
        : this.calculateNextPeriodEnd();

    const updatedSubscription = await this.subscriptionsRepository.applyUpgrade(
      workspaceId,
      targetPlan.id,
      currentPeriodEnd,
    );

    await this.planChangeLogRepository.create({
      workspaceId,
      requestedByUserId: principal.user.id,
      fromPlanId: subscription.plan.id,
      toPlanId: targetPlan.id,
      changeType: PlanChangeType.UPGRADE,
      effectiveAt: new Date(),
      prorationAmount,
    });

    try {
      await this.mailService.sendTemplate('plan-upgraded', principal.email, {
        userName: this.getActorDisplayName(principal),
        previousPlanName: subscription.plan.name,
        newPlanName: targetPlan.name,
        newPlanPrice: this.formatPrice(targetPlan),
        effectiveDate: this.formatDate(new Date()),
      });
    } catch (error) {
      this.logger.error(
        `Failed to send upgrade email to ${principal.email}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return {
      message: `Successfully upgraded to ${targetPlan.name} plan`,
      subscription: this.toSubscriptionDto(updatedSubscription),
      prorationAmount,
    };
  }

  async downgradePlan(
    principal: AuthenticatedPrincipal,
    targetPlanCode: string,
  ): Promise<DowngradeResponseDto> {
    const workspaceId = this.assertBillingAdmin(principal);
    const subscription =
      await this.subscriptionsRepository.findByWorkspaceId(workspaceId);

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

    const overages = await this.detectResourceOverages(workspaceId, targetPlan);
    const hasOverages = overages.length > 0;
    const scheduledChangeAt = subscription.currentPeriodEnd ?? new Date();

    let gracePeriodEnd: Date | undefined;
    let graceOverages: Record<string, number> | undefined;

    if (hasOverages) {
      gracePeriodEnd = new Date(scheduledChangeAt);
      gracePeriodEnd.setDate(
        gracePeriodEnd.getDate() + SUBSCRIPTION_CONSTANTS.GRACE_PERIOD_DAYS,
      );

      graceOverages = {};
      for (const overage of overages) {
        graceOverages[overage.featureCode] = overage.overage;
      }
    }

    await this.subscriptionsRepository.scheduleDowngrade(
      workspaceId,
      targetPlan.id,
      scheduledChangeAt,
      graceOverages,
      gracePeriodEnd,
    );

    await this.planChangeLogRepository.create({
      workspaceId,
      requestedByUserId: principal.user.id,
      fromPlanId: subscription.plan.id,
      toPlanId: targetPlan.id,
      changeType: PlanChangeType.DOWNGRADE_SCHEDULED,
      scheduledFor: scheduledChangeAt,
      metadata: hasOverages ? { overages } : undefined,
    });

    try {
      await this.mailService.sendTemplate(
        'plan-downgrade-scheduled',
        principal.email,
        {
          userName: this.getActorDisplayName(principal),
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
        `Failed to send downgrade email to ${principal.email}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    const updatedSubscription =
      await this.subscriptionsRepository.findByWorkspaceId(workspaceId);

    return {
      message: `Downgrade to ${targetPlan.name} plan scheduled for ${this.formatDate(scheduledChangeAt)}`,
      subscription: this.toSubscriptionDto(updatedSubscription!),
      scheduledFor: scheduledChangeAt,
      targetPlanCode: targetPlan.code,
      overages,
      gracePeriodEnd,
    };
  }

  async cancelSubscription(
    principal: AuthenticatedPrincipal,
    reason: string | undefined,
  ): Promise<CancelResponseDto> {
    const workspaceId = this.assertBillingAdmin(principal);
    const subscription =
      await this.subscriptionsRepository.findByWorkspaceId(workspaceId);

    if (!subscription) {
      throw new BusinessException(
        ERROR_CODES.NO_SUBSCRIPTION,
        'No active subscription found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (subscription.plan.code === PLAN_CODES.FREE) {
      throw new BusinessException(
        ERROR_CODES.CANNOT_CANCEL_FREE_PLAN,
        'Cannot cancel a free plan',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (subscription.cancelledAt) {
      throw new BusinessException(
        ERROR_CODES.SUBSCRIPTION_ALREADY_CANCELLED,
        'Subscription is already cancelled',
        HttpStatus.BAD_REQUEST,
      );
    }

    const freePlan = await this.plansRepository.findByCode(PLAN_CODES.FREE);
    if (!freePlan) {
      throw new BusinessException(
        ERROR_CODES.PLAN_NOT_FOUND,
        'Free plan not found',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const effectiveAt = subscription.currentPeriodEnd ?? new Date();

    await this.subscriptionsRepository.scheduleCancellation(
      workspaceId,
      freePlan.id,
      effectiveAt,
      reason,
    );

    await this.planChangeLogRepository.create({
      workspaceId,
      requestedByUserId: principal.user.id,
      fromPlanId: subscription.plan.id,
      toPlanId: freePlan.id,
      changeType: PlanChangeType.CANCELLATION,
      scheduledFor: effectiveAt,
      reason,
    });

    try {
      await this.mailService.sendTemplate(
        'subscription-cancelled',
        principal.email,
        {
          userName: this.getActorDisplayName(principal),
          currentPlanName: subscription.plan.name,
          effectiveDate: this.formatDate(effectiveAt),
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to send cancellation email to ${principal.email}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return {
      message: 'Subscription cancellation scheduled',
      cancelledAt: new Date(),
      effectiveAt,
    };
  }

  async reactivateSubscription(
    principal: AuthenticatedPrincipal,
  ): Promise<ReactivateResponseDto> {
    const workspaceId = this.assertBillingAdmin(principal);
    const subscription =
      await this.subscriptionsRepository.findByWorkspaceId(workspaceId);

    if (!subscription) {
      throw new BusinessException(
        ERROR_CODES.NO_SUBSCRIPTION,
        'No active subscription found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (!subscription.cancelledAt) {
      throw new BusinessException(
        ERROR_CODES.NO_PENDING_CANCELLATION,
        'No pending cancellation to reactivate',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updatedSubscription =
      await this.subscriptionsRepository.reactivate(workspaceId);

    await this.planChangeLogRepository.create({
      workspaceId,
      requestedByUserId: principal.user.id,
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

  async cancelScheduledChange(
    principal: AuthenticatedPrincipal,
  ): Promise<CancelScheduledChangeResponseDto> {
    const workspaceId = this.assertBillingAdmin(principal);
    const subscription =
      await this.subscriptionsRepository.findByWorkspaceIdWithScheduledPlan(
        workspaceId,
      );

    if (!subscription) {
      throw new BusinessException(
        ERROR_CODES.NO_SUBSCRIPTION,
        'No active subscription found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (!subscription.scheduledPlanId) {
      throw new BusinessException(
        ERROR_CODES.NO_SCHEDULED_CHANGE,
        'No scheduled plan change to cancel',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (subscription.cancelledAt) {
      throw new BusinessException(
        ERROR_CODES.SUBSCRIPTION_ALREADY_CANCELLED,
        'Use the reactivate endpoint to undo a cancellation',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updatedSubscription =
      await this.subscriptionsRepository.cancelScheduledChange(workspaceId);

    return {
      message: 'Scheduled change cancelled successfully',
      subscription: this.toSubscriptionDto(updatedSubscription),
    };
  }

  async getPlanChangeHistory(
    principal: AuthenticatedPrincipal,
    limit: number = 20,
  ): Promise<PlanChangeLogDto[]> {
    const workspaceId = this.assertBillingAdmin(principal);
    const logs = await this.planChangeLogRepository.findByWorkspaceId(
      workspaceId,
      limit,
    );

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

  private assertBillingAdmin(principal: AuthenticatedPrincipal): string {
    if (
      principal.workspaceRole !== WorkspaceRole.ADMIN ||
      principal.membership.role !== WorkspaceRole.ADMIN
    ) {
      throw new BusinessException(
        ERROR_CODES.FORBIDDEN,
        'Only workspace admins can manage billing and plan changes',
        HttpStatus.FORBIDDEN,
      );
    }

    return principal.workspaceId;
  }

  private getActorDisplayName(principal: AuthenticatedPrincipal): string {
    return principal.user.firstName || principal.email || 'there';
  }

  private async detectResourceOverages(
    workspaceId: string,
    targetPlan: PlanWithFeatures,
  ): Promise<ResourceOverageDto[]> {
    const overages: ResourceOverageDto[] = [];

    const resourceFeatures = targetPlan.planFeatures.filter(
      (f) =>
        f.featureType === FeatureType.RESOURCE &&
        f.limitType === FeatureLimitType.COUNT,
    );

    for (const feature of resourceFeatures) {
      const currentCount = await this.getResourceCount(
        workspaceId,
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

  private async getResourceCount(
    _workspaceId: string,
    _featureCode: FeatureCode,
  ): Promise<number> {
    return 0;
  }

  private featureHasGracePeriod(featureCode: string): boolean {
    const gracePeriodFeatures: readonly string[] = [];

    return gracePeriodFeatures.includes(featureCode);
  }

  private calculateProration(
    subscription: SubscriptionWithPlan,
    targetPlan: PlanWithFeatures,
  ): number {
    if (!subscription.currentPeriodEnd) {
      return 0;
    }

    const now = new Date();
    const periodEnd = subscription.currentPeriodEnd;
    const periodStart = subscription.currentPeriodStart;

    const totalDays = Math.ceil(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    const daysRemaining = Math.ceil(
      (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysRemaining <= 0 || totalDays <= 0) {
      return 0;
    }

    const currentMonthlyPrice =
      toDecimalNumber(subscription.plan.priceMonthly) ?? 0;
    const dailyRateCurrent = currentMonthlyPrice / 30;
    const creditAmount = dailyRateCurrent * daysRemaining;

    const newMonthlyPrice = toDecimalNumber(targetPlan.priceMonthly) ?? 0;
    const dailyRateNew = newMonthlyPrice / 30;
    const chargeAmount = dailyRateNew * daysRemaining;

    return Math.round((creditAmount - chargeAmount) * 100) / 100;
  }

  private calculateNextPeriodEnd(): Date {
    const date = new Date();
    date.setDate(date.getDate() + SUBSCRIPTION_CONSTANTS.BILLING_PERIOD_DAYS);
    return date;
  }

  private formatPrice(plan: PlanWithFeatures): string {
    const price = toDecimalNumber(plan.priceMonthly) ?? 0;
    if (price === 0) return 'Free';
    return `$${price.toFixed(2)}/${plan.priceCurrency === 'USD' ? 'month' : plan.priceCurrency}`;
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private formatFeatureName(featureCode: string): string {
    return featureCode
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

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
