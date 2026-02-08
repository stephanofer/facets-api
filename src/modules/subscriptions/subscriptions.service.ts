import { Injectable, HttpStatus } from '@nestjs/common';
import {
  PlansRepository,
  PlanWithFeatures,
} from '@modules/subscriptions/repositories/plans.repository';
import {
  SubscriptionsRepository,
  SubscriptionWithPlan,
} from '@modules/subscriptions/repositories/subscriptions.repository';
import { UsageRepository } from '@modules/subscriptions/repositories/usage.repository';
import { FeatureCode } from '@modules/subscriptions/constants/features.constant';
import {
  PlanDto,
  SubscriptionDto,
  FeatureUsageDto,
  UsageResponseDto,
  FeatureCheckResultDto,
  toPlanDto,
} from '@modules/subscriptions/dtos/subscription.dto';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_CODES } from '@common/constants/app.constants';
import {
  FeatureLimitType,
  FeatureType,
  LimitPeriod,
  PlanFeature,
} from '../../generated/prisma/client';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly plansRepository: PlansRepository,
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly usageRepository: UsageRepository,
  ) {}

  // ==========================================================================
  // Plans
  // ==========================================================================

  /**
   * Get all active plans
   */
  async getAllPlans(): Promise<PlanDto[]> {
    const plans = await this.plansRepository.findAllActive();
    return plans.map(toPlanDto);
  }

  /**
   * Get a single plan by code
   */
  async getPlanByCode(code: string): Promise<PlanDto> {
    const plan = await this.plansRepository.findByCode(code);
    if (!plan) {
      throw new BusinessException(
        ERROR_CODES.RESOURCE_NOT_FOUND,
        `Plan '${code}' not found`,
        HttpStatus.NOT_FOUND,
      );
    }
    return toPlanDto(plan);
  }

  /**
   * Get the default plan (FREE)
   */
  async getDefaultPlan(): Promise<PlanWithFeatures> {
    const plan = await this.plansRepository.findDefault();
    if (!plan) {
      throw new BusinessException(
        ERROR_CODES.INTERNAL_ERROR,
        'Default plan not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return plan;
  }

  // ==========================================================================
  // Subscriptions
  // ==========================================================================

  /**
   * Get user's current subscription
   */
  async getUserSubscription(userId: string): Promise<SubscriptionDto> {
    const subscription =
      await this.subscriptionsRepository.findByUserId(userId);

    if (!subscription) {
      throw new BusinessException(
        ERROR_CODES.RESOURCE_NOT_FOUND,
        'No active subscription found',
        HttpStatus.NOT_FOUND,
      );
    }

    return this.toSubscriptionDto(subscription);
  }

  /**
   * Create a subscription for a new user (assign FREE plan)
   */
  async createSubscriptionForNewUser(
    userId: string,
  ): Promise<SubscriptionWithPlan> {
    const defaultPlan = await this.getDefaultPlan();

    return this.subscriptionsRepository.create({
      userId,
      planId: defaultPlan.id,
      currentPeriodEnd: null, // Free plan has no end date
    });
  }

  /**
   * Check if user has a subscription
   */
  async hasSubscription(userId: string): Promise<boolean> {
    const subscription =
      await this.subscriptionsRepository.findByUserId(userId);
    return subscription !== null;
  }

  // ==========================================================================
  // Feature Access Control
  // ==========================================================================

  /**
   * Check if a user can access a feature (for boolean features)
   * or if they haven't exceeded their limit (for count features)
   */
  async checkFeatureAccess(
    userId: string,
    featureCode: FeatureCode,
    resourceCount?: number, // For RESOURCE type, current count from table
  ): Promise<FeatureCheckResultDto> {
    const feature = await this.subscriptionsRepository.getUserPlanFeature(
      userId,
      featureCode,
    );

    // If feature not found in plan, deny access
    if (!feature) {
      return {
        allowed: false,
        reason: 'FEATURE_NOT_AVAILABLE',
        current: 0,
        limit: 0,
      };
    }

    // Check based on limit type
    switch (feature.limitType) {
      case FeatureLimitType.UNLIMITED:
        return {
          allowed: true,
          current: resourceCount ?? 0,
          limit: -1,
        };

      case FeatureLimitType.BOOLEAN:
        return {
          allowed: feature.limitValue === 1,
          reason:
            feature.limitValue !== 1 ? 'FEATURE_NOT_AVAILABLE' : undefined,
          current: 0,
          limit: feature.limitValue,
        };

      case FeatureLimitType.COUNT:
        return this.checkCountLimit(userId, feature, resourceCount);

      default:
        return {
          allowed: false,
          reason: 'UNKNOWN_LIMIT_TYPE',
          current: 0,
          limit: 0,
        };
    }
  }

  /**
   * Check count-based limit for RESOURCE or CONSUMABLE features
   */
  private async checkCountLimit(
    userId: string,
    feature: PlanFeature,
    resourceCount?: number,
  ): Promise<FeatureCheckResultDto> {
    let currentUsage: number;

    if (feature.featureType === FeatureType.RESOURCE) {
      // For RESOURCE, the caller must provide the current count from the table
      currentUsage = resourceCount ?? 0;
    } else {
      // For CONSUMABLE, get usage from UsageRecord
      currentUsage = await this.usageRepository.getCurrentUsage(
        userId,
        feature.featureCode,
        feature.limitPeriod ?? LimitPeriod.MONTHLY,
      );
    }

    const allowed = currentUsage < feature.limitValue;

    return {
      allowed,
      reason: allowed ? undefined : 'FEATURE_LIMIT_EXCEEDED',
      current: currentUsage,
      limit: feature.limitValue,
    };
  }

  /**
   * Increment usage for a consumable feature
   * Call this after successfully creating a resource (e.g., transaction)
   */
  async incrementUsage(
    userId: string,
    featureCode: FeatureCode,
    periodType: LimitPeriod = LimitPeriod.MONTHLY,
    amount: number = 1,
  ): Promise<void> {
    await this.usageRepository.incrementUsage(
      userId,
      featureCode,
      periodType,
      amount,
    );
  }

  /**
   * Decrement usage (for admin corrections only)
   * Note: Deleting a resource does NOT restore consumable usage
   */
  async decrementUsage(
    userId: string,
    featureCode: FeatureCode,
    periodType: LimitPeriod = LimitPeriod.MONTHLY,
    amount: number = 1,
  ): Promise<void> {
    await this.usageRepository.decrementUsage(
      userId,
      featureCode,
      periodType,
      amount,
    );
  }

  // ==========================================================================
  // Usage Reporting
  // ==========================================================================

  /**
   * Get current usage for all features for a user
   *
   * Uses a single batch query to fetch all usage records instead of
   * querying individually per feature (resolves N+1 problem).
   */
  async getUserUsage(userId: string): Promise<UsageResponseDto> {
    const subscription =
      await this.subscriptionsRepository.findByUserId(userId);

    if (!subscription) {
      throw new BusinessException(
        ERROR_CODES.RESOURCE_NOT_FOUND,
        'No active subscription found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Batch query: get ALL usage records for this user in one query
    const allUsage = await this.usageRepository.getAllCurrentUsage(userId);
    const usageMap = new Map(allUsage.map((u) => [u.featureCode, u]));

    // Map features synchronously using the pre-fetched usage data
    const features: FeatureUsageDto[] = subscription.plan.planFeatures.map(
      (planFeature) => this.mapFeatureUsage(planFeature, usageMap),
    );

    return {
      planCode: subscription.plan.code,
      planName: subscription.plan.name,
      features,
    };
  }

  /**
   * Map a plan feature to its usage DTO using pre-fetched usage data
   *
   * This is a synchronous operation — no DB queries needed because
   * usage data was already fetched in batch.
   */
  private mapFeatureUsage(
    planFeature: PlanFeature,
    usageMap: Map<string, { count: number; periodEnd: Date }>,
  ): FeatureUsageDto {
    let current = 0;
    let periodEnd: Date | undefined;

    if (planFeature.limitType === FeatureLimitType.COUNT) {
      if (planFeature.featureType === FeatureType.CONSUMABLE) {
        const usageRecord = usageMap.get(planFeature.featureCode);
        current = usageRecord?.count ?? 0;
        periodEnd = usageRecord?.periodEnd;
      }
      // For RESOURCE type, the actual count should come from the specific
      // resource service — intentionally left at 0 here
    }

    const limit = planFeature.limitValue;
    const usagePercentage = limit > 0 ? Math.round((current / limit) * 100) : 0;
    const limitReached =
      planFeature.limitType === FeatureLimitType.COUNT && current >= limit;

    return {
      featureCode: planFeature.featureCode,
      current,
      limit,
      limitType: planFeature.limitType,
      featureType: planFeature.featureType,
      periodType: planFeature.limitPeriod ?? undefined,
      periodEnd,
      usagePercentage:
        planFeature.limitType === FeatureLimitType.UNLIMITED
          ? 0
          : usagePercentage,
      limitReached:
        planFeature.limitType === FeatureLimitType.UNLIMITED
          ? false
          : limitReached,
    };
  }

  /**
   * Get feature limit for a user (used by FeatureGuard)
   */
  async getFeatureLimit(
    userId: string,
    featureCode: FeatureCode,
  ): Promise<PlanFeature | null> {
    return this.subscriptionsRepository.getUserPlanFeature(userId, featureCode);
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

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
