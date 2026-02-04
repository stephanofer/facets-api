import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import {
  Subscription,
  SubscriptionStatus,
  Plan,
  PlanFeature,
  Prisma,
} from '../../../generated/prisma/client';

export interface SubscriptionWithPlan extends Subscription {
  plan: Plan & { planFeatures: PlanFeature[] };
}

export interface SubscriptionWithScheduledPlan extends SubscriptionWithPlan {
  scheduledPlan: (Plan & { planFeatures: PlanFeature[] }) | null;
}

export interface CreateSubscriptionData {
  userId: string;
  planId: string;
  status?: SubscriptionStatus;
  currentPeriodEnd?: Date | null;
}

// Standard include for plan with features
const planWithFeaturesInclude = {
  plan: {
    include: { planFeatures: true },
  },
} as const;

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new subscription for a user
   */
  async create(data: CreateSubscriptionData): Promise<SubscriptionWithPlan> {
    const result = await this.prisma.subscription.create({
      data: {
        userId: data.userId,
        planId: data.planId,
        status: data.status ?? SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: data.currentPeriodEnd,
      },
      include: planWithFeaturesInclude,
    });
    return result as SubscriptionWithPlan;
  }

  /**
   * Find subscription by user ID
   */
  async findByUserId(userId: string): Promise<SubscriptionWithPlan | null> {
    const result = await this.prisma.subscription.findUnique({
      where: { userId },
      include: planWithFeaturesInclude,
    });
    return result as SubscriptionWithPlan | null;
  }

  /**
   * Find subscription by ID
   */
  async findById(id: string): Promise<SubscriptionWithPlan | null> {
    const result = await this.prisma.subscription.findUnique({
      where: { id },
      include: planWithFeaturesInclude,
    });
    return result as SubscriptionWithPlan | null;
  }

  /**
   * Update subscription plan
   */
  async updatePlan(
    userId: string,
    planId: string,
    currentPeriodEnd?: Date | null,
  ): Promise<SubscriptionWithPlan> {
    const result = await this.prisma.subscription.update({
      where: { userId },
      data: {
        planId,
        currentPeriodStart: new Date(),
        currentPeriodEnd,
        updatedAt: new Date(),
      },
      include: planWithFeaturesInclude,
    });
    return result as SubscriptionWithPlan;
  }

  /**
   * Update subscription status
   */
  async updateStatus(
    userId: string,
    status: SubscriptionStatus,
  ): Promise<SubscriptionWithPlan> {
    const result = await this.prisma.subscription.update({
      where: { userId },
      data: { status },
      include: planWithFeaturesInclude,
    });
    return result as SubscriptionWithPlan;
  }

  /**
   * Check if user has an active subscription
   */
  async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { status: true },
    });

    return (
      subscription?.status === SubscriptionStatus.ACTIVE ||
      subscription?.status === SubscriptionStatus.TRIALING
    );
  }

  /**
   * Get the user's current plan feature
   */
  async getUserPlanFeature(
    userId: string,
    featureCode: string,
  ): Promise<PlanFeature | null> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: {
        plan: {
          include: {
            planFeatures: {
              where: { featureCode },
            },
          },
        },
      },
    });

    return subscription?.plan?.planFeatures[0] ?? null;
  }

  // ==========================================================================
  // Phase 4: Plan Management Methods
  // ==========================================================================

  /**
   * Schedule a plan change (for downgrades)
   */
  async scheduleDowngrade(
    userId: string,
    scheduledPlanId: string,
    scheduledChangeAt: Date,
    graceOverages?: Record<string, number>,
    gracePeriodEnd?: Date,
  ): Promise<SubscriptionWithPlan> {
    const result = await this.prisma.subscription.update({
      where: { userId },
      data: {
        scheduledPlanId,
        scheduledChangeAt,
        graceOverages:
          graceOverages !== undefined
            ? (graceOverages as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        gracePeriodEnd: gracePeriodEnd ?? null,
      },
      include: planWithFeaturesInclude,
    });
    return result as SubscriptionWithPlan;
  }

  /**
   * Apply an immediate upgrade
   */
  async applyUpgrade(
    userId: string,
    newPlanId: string,
    currentPeriodEnd: Date | null,
  ): Promise<SubscriptionWithPlan> {
    const result = await this.prisma.subscription.update({
      where: { userId },
      data: {
        planId: newPlanId,
        currentPeriodStart: new Date(),
        currentPeriodEnd,
        status: SubscriptionStatus.ACTIVE,
        // Clear any scheduled changes
        scheduledPlanId: null,
        scheduledChangeAt: null,
        cancelledAt: null,
        cancelReason: null,
        graceOverages: Prisma.JsonNull,
        gracePeriodEnd: null,
      },
      include: planWithFeaturesInclude,
    });
    return result as SubscriptionWithPlan;
  }

  /**
   * Schedule cancellation (downgrade to FREE at end of period)
   */
  async scheduleCancellation(
    userId: string,
    freePlanId: string,
    scheduledChangeAt: Date,
    reason?: string,
  ): Promise<SubscriptionWithPlan> {
    const result = await this.prisma.subscription.update({
      where: { userId },
      data: {
        scheduledPlanId: freePlanId,
        scheduledChangeAt,
        cancelledAt: new Date(),
        cancelReason: reason ?? null,
      },
      include: planWithFeaturesInclude,
    });
    return result as SubscriptionWithPlan;
  }

  /**
   * Reactivate a cancelled subscription
   */
  async reactivate(userId: string): Promise<SubscriptionWithPlan> {
    const result = await this.prisma.subscription.update({
      where: { userId },
      data: {
        scheduledPlanId: null,
        scheduledChangeAt: null,
        cancelledAt: null,
        cancelReason: null,
      },
      include: planWithFeaturesInclude,
    });
    return result as SubscriptionWithPlan;
  }

  /**
   * Cancel a scheduled change (downgrade or cancellation)
   */
  async cancelScheduledChange(userId: string): Promise<SubscriptionWithPlan> {
    const result = await this.prisma.subscription.update({
      where: { userId },
      data: {
        scheduledPlanId: null,
        scheduledChangeAt: null,
        cancelledAt: null,
        cancelReason: null,
        graceOverages: Prisma.JsonNull,
        gracePeriodEnd: null,
      },
      include: planWithFeaturesInclude,
    });
    return result as SubscriptionWithPlan;
  }

  /**
   * Apply a scheduled plan change (used by cron job)
   */
  async applyScheduledChange(
    userId: string,
    newPlanId: string,
    currentPeriodEnd: Date | null,
    graceOverages?: Record<string, number>,
    gracePeriodEnd?: Date,
  ): Promise<SubscriptionWithPlan> {
    const result = await this.prisma.subscription.update({
      where: { userId },
      data: {
        planId: newPlanId,
        currentPeriodStart: new Date(),
        currentPeriodEnd,
        status: SubscriptionStatus.ACTIVE,
        scheduledPlanId: null,
        scheduledChangeAt: null,
        cancelledAt: null,
        cancelReason: null,
        graceOverages:
          graceOverages !== undefined
            ? (graceOverages as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        gracePeriodEnd: gracePeriodEnd ?? null,
      },
      include: planWithFeaturesInclude,
    });
    return result as SubscriptionWithPlan;
  }

  /**
   * Find all subscriptions with scheduled changes that are due
   */
  async findDueScheduledChanges(): Promise<SubscriptionWithScheduledPlan[]> {
    const now = new Date();
    const results = await this.prisma.subscription.findMany({
      where: {
        scheduledPlanId: { not: null },
        scheduledChangeAt: { lte: now },
      },
      include: {
        plan: {
          include: { planFeatures: true },
        },
        scheduledPlan: {
          include: { planFeatures: true },
        },
      },
    });
    return results as SubscriptionWithScheduledPlan[];
  }

  /**
   * Find all subscriptions with expired grace periods
   */
  async findExpiredGracePeriods(): Promise<SubscriptionWithPlan[]> {
    const now = new Date();
    const results = await this.prisma.subscription.findMany({
      where: {
        gracePeriodEnd: { lt: now },
        graceOverages: { not: Prisma.AnyNull },
      },
      include: planWithFeaturesInclude,
    });
    return results as SubscriptionWithPlan[];
  }

  /**
   * Clear grace period data after it expires
   */
  async clearGracePeriod(userId: string): Promise<SubscriptionWithPlan> {
    const result = await this.prisma.subscription.update({
      where: { userId },
      data: {
        graceOverages: Prisma.JsonNull,
        gracePeriodEnd: null,
      },
      include: planWithFeaturesInclude,
    });
    return result as SubscriptionWithPlan;
  }

  /**
   * Find subscription with scheduled plan included
   */
  async findByUserIdWithScheduledPlan(
    userId: string,
  ): Promise<SubscriptionWithScheduledPlan | null> {
    const result = await this.prisma.subscription.findUnique({
      where: { userId },
      include: {
        plan: {
          include: { planFeatures: true },
        },
        scheduledPlan: {
          include: { planFeatures: true },
        },
      },
    });
    return result as SubscriptionWithScheduledPlan | null;
  }
}
