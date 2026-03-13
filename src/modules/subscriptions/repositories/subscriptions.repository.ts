import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import {
  Plan,
  PlanFeature,
  Prisma,
  Subscription,
  SubscriptionStatus,
} from '../../../generated/prisma/client';

export interface SubscriptionWithPlan extends Subscription {
  plan: Plan & { planFeatures: PlanFeature[] };
}

export interface SubscriptionWithScheduledPlan extends SubscriptionWithPlan {
  scheduledPlan: (Plan & { planFeatures: PlanFeature[] }) | null;
}

export interface CreateSubscriptionData {
  workspaceId: string;
  planId: string;
  status?: SubscriptionStatus;
  currentPeriodEnd?: Date | null;
}

const planWithFeaturesInclude = {
  plan: {
    include: { planFeatures: true },
  },
} as const;

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateSubscriptionData): Promise<SubscriptionWithPlan> {
    const result = await this.prisma.subscription.create({
      data: {
        workspaceId: data.workspaceId,
        planId: data.planId,
        status: data.status ?? SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: data.currentPeriodEnd,
      },
      include: planWithFeaturesInclude,
    });

    return result as SubscriptionWithPlan;
  }

  async findByWorkspaceId(
    workspaceId: string,
  ): Promise<SubscriptionWithPlan | null> {
    const result = await this.prisma.subscription.findUnique({
      where: { workspaceId },
      include: planWithFeaturesInclude,
    });

    return result as SubscriptionWithPlan | null;
  }

  async findById(id: string): Promise<SubscriptionWithPlan | null> {
    const result = await this.prisma.subscription.findUnique({
      where: { id },
      include: planWithFeaturesInclude,
    });

    return result as SubscriptionWithPlan | null;
  }

  async updatePlan(
    workspaceId: string,
    planId: string,
    currentPeriodEnd?: Date | null,
  ): Promise<SubscriptionWithPlan> {
    const result = await this.prisma.subscription.update({
      where: { workspaceId },
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

  async updateStatus(
    workspaceId: string,
    status: SubscriptionStatus,
  ): Promise<SubscriptionWithPlan> {
    const result = await this.prisma.subscription.update({
      where: { workspaceId },
      data: { status },
      include: planWithFeaturesInclude,
    });

    return result as SubscriptionWithPlan;
  }

  async hasActiveSubscription(workspaceId: string): Promise<boolean> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
      select: { status: true },
    });

    return (
      subscription?.status === SubscriptionStatus.ACTIVE ||
      subscription?.status === SubscriptionStatus.TRIALING
    );
  }

  async getWorkspacePlanFeature(
    workspaceId: string,
    featureCode: string,
  ): Promise<PlanFeature | null> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
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

  async scheduleDowngrade(
    workspaceId: string,
    scheduledPlanId: string,
    scheduledChangeAt: Date,
    graceOverages?: Record<string, number>,
    gracePeriodEnd?: Date,
  ): Promise<SubscriptionWithPlan> {
    const result = await this.prisma.subscription.update({
      where: { workspaceId },
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

  async applyUpgrade(
    workspaceId: string,
    newPlanId: string,
    currentPeriodEnd: Date | null,
  ): Promise<SubscriptionWithPlan> {
    const result = await this.prisma.subscription.update({
      where: { workspaceId },
      data: {
        planId: newPlanId,
        currentPeriodStart: new Date(),
        currentPeriodEnd,
        status: SubscriptionStatus.ACTIVE,
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

  async scheduleCancellation(
    workspaceId: string,
    freePlanId: string,
    scheduledChangeAt: Date,
    reason?: string,
  ): Promise<SubscriptionWithPlan> {
    const result = await this.prisma.subscription.update({
      where: { workspaceId },
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

  async reactivate(workspaceId: string): Promise<SubscriptionWithPlan> {
    const result = await this.prisma.subscription.update({
      where: { workspaceId },
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

  async cancelScheduledChange(
    workspaceId: string,
  ): Promise<SubscriptionWithPlan> {
    const result = await this.prisma.subscription.update({
      where: { workspaceId },
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

  async applyScheduledChange(
    workspaceId: string,
    newPlanId: string,
    currentPeriodEnd: Date | null,
    graceOverages?: Record<string, number>,
    gracePeriodEnd?: Date,
  ): Promise<SubscriptionWithPlan> {
    const result = await this.prisma.subscription.update({
      where: { workspaceId },
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

  async clearGracePeriod(workspaceId: string): Promise<SubscriptionWithPlan> {
    const result = await this.prisma.subscription.update({
      where: { workspaceId },
      data: {
        graceOverages: Prisma.JsonNull,
        gracePeriodEnd: null,
      },
      include: planWithFeaturesInclude,
    });

    return result as SubscriptionWithPlan;
  }

  async findByWorkspaceIdWithScheduledPlan(
    workspaceId: string,
  ): Promise<SubscriptionWithScheduledPlan | null> {
    const result = await this.prisma.subscription.findUnique({
      where: { workspaceId },
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
