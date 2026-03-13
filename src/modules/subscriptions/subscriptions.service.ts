import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@common/constants/app.constants';
import { BusinessException } from '@common/exceptions/business.exception';
import { FeatureCode } from '@modules/subscriptions/constants/features.constant';
import {
  FeatureCheckResultDto,
  FeatureUsageDto,
  PlanDto,
  SubscriptionDto,
  UsageResponseDto,
  toPlanDto,
} from '@modules/subscriptions/dtos/subscription.dto';
import {
  PlanWithFeatures,
  PlansRepository,
} from '@modules/subscriptions/repositories/plans.repository';
import {
  SubscriptionWithPlan,
  SubscriptionsRepository,
} from '@modules/subscriptions/repositories/subscriptions.repository';
import { UsageRepository } from '@modules/subscriptions/repositories/usage.repository';
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

  async getAllPlans(): Promise<PlanDto[]> {
    const plans = await this.plansRepository.findAllActive();
    return plans.map(toPlanDto);
  }

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

  async getWorkspaceSubscription(
    workspaceId: string,
  ): Promise<SubscriptionDto> {
    const subscription =
      await this.subscriptionsRepository.findByWorkspaceId(workspaceId);

    if (!subscription) {
      throw new BusinessException(
        ERROR_CODES.RESOURCE_NOT_FOUND,
        'No active subscription found',
        HttpStatus.NOT_FOUND,
      );
    }

    return this.toSubscriptionDto(subscription);
  }

  async createSubscriptionForWorkspace(
    workspaceId: string,
  ): Promise<SubscriptionWithPlan> {
    const defaultPlan = await this.getDefaultPlan();

    return this.subscriptionsRepository.create({
      workspaceId,
      planId: defaultPlan.id,
      currentPeriodEnd: null,
    });
  }

  async hasWorkspaceSubscription(workspaceId: string): Promise<boolean> {
    const subscription =
      await this.subscriptionsRepository.findByWorkspaceId(workspaceId);
    return subscription !== null;
  }

  async checkWorkspaceFeatureAccess(
    workspaceId: string,
    featureCode: FeatureCode,
    resourceCount?: number,
  ): Promise<FeatureCheckResultDto> {
    const feature = await this.subscriptionsRepository.getWorkspacePlanFeature(
      workspaceId,
      featureCode,
    );

    if (!feature) {
      return {
        allowed: false,
        reason: 'FEATURE_NOT_AVAILABLE',
        current: 0,
        limit: 0,
      };
    }

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
        return this.checkCountLimit(workspaceId, feature, resourceCount);
      default:
        return {
          allowed: false,
          reason: 'UNKNOWN_LIMIT_TYPE',
          current: 0,
          limit: 0,
        };
    }
  }

  async incrementUsage(
    workspaceId: string,
    featureCode: FeatureCode,
    periodType: LimitPeriod = LimitPeriod.MONTHLY,
    amount: number = 1,
  ): Promise<void> {
    await this.usageRepository.incrementUsage(
      workspaceId,
      featureCode,
      periodType,
      amount,
    );
  }

  async decrementUsage(
    workspaceId: string,
    featureCode: FeatureCode,
    periodType: LimitPeriod = LimitPeriod.MONTHLY,
    amount: number = 1,
  ): Promise<void> {
    await this.usageRepository.decrementUsage(
      workspaceId,
      featureCode,
      periodType,
      amount,
    );
  }

  async getWorkspaceUsage(workspaceId: string): Promise<UsageResponseDto> {
    const subscription =
      await this.subscriptionsRepository.findByWorkspaceId(workspaceId);

    if (!subscription) {
      throw new BusinessException(
        ERROR_CODES.RESOURCE_NOT_FOUND,
        'No active subscription found',
        HttpStatus.NOT_FOUND,
      );
    }

    const allUsage = await this.usageRepository.getAllCurrentUsage(workspaceId);
    const usageMap = new Map(allUsage.map((u) => [u.featureCode, u]));

    const features: FeatureUsageDto[] = subscription.plan.planFeatures.map(
      (planFeature) => this.mapFeatureUsage(planFeature, usageMap),
    );

    return {
      planCode: subscription.plan.code,
      planName: subscription.plan.name,
      features,
    };
  }

  async getWorkspaceFeatureLimit(
    workspaceId: string,
    featureCode: FeatureCode,
  ): Promise<PlanFeature | null> {
    return this.subscriptionsRepository.getWorkspacePlanFeature(
      workspaceId,
      featureCode,
    );
  }

  private async checkCountLimit(
    workspaceId: string,
    feature: PlanFeature,
    resourceCount?: number,
  ): Promise<FeatureCheckResultDto> {
    let currentUsage: number;

    if (feature.featureType === FeatureType.RESOURCE) {
      currentUsage = resourceCount ?? 0;
    } else {
      currentUsage = await this.usageRepository.getCurrentUsage(
        workspaceId,
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
