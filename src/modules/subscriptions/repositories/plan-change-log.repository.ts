import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { PlanChangeType, Plan, Prisma } from '../../../generated/prisma/client';
import { Decimal } from '@prisma/client/runtime/client';

/**
 * Base PlanChangeLog interface to avoid LSP issues
 */
export interface PlanChangeLogBase {
  id: string;
  userId: string;
  fromPlanId: string;
  toPlanId: string;
  changeType: PlanChangeType;
  requestedAt: Date;
  effectiveAt: Date | null;
  scheduledFor: Date | null;
  prorationAmount: Decimal | null;
  reason: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}

export interface PlanChangeLogWithPlans extends PlanChangeLogBase {
  fromPlan: Plan;
  toPlan: Plan;
}

export interface CreatePlanChangeLogData {
  userId: string;
  fromPlanId: string;
  toPlanId: string;
  changeType: PlanChangeType;
  effectiveAt?: Date;
  scheduledFor?: Date;
  prorationAmount?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

// Standard include for plan relations
const plansInclude = {
  fromPlan: true,
  toPlan: true,
} as const;

@Injectable()
export class PlanChangeLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new plan change log entry
   */
  async create(data: CreatePlanChangeLogData): Promise<PlanChangeLogWithPlans> {
    const result = await this.prisma.planChangeLog.create({
      data: {
        userId: data.userId,
        fromPlanId: data.fromPlanId,
        toPlanId: data.toPlanId,
        changeType: data.changeType,
        effectiveAt: data.effectiveAt,
        scheduledFor: data.scheduledFor,
        prorationAmount: data.prorationAmount,
        reason: data.reason,
        metadata: data.metadata
          ? (data.metadata as Prisma.InputJsonValue)
          : undefined,
      },
      include: plansInclude,
    });
    return result as PlanChangeLogWithPlans;
  }

  /**
   * Get plan change history for a user
   */
  async findByUserId(
    userId: string,
    limit: number = 20,
  ): Promise<PlanChangeLogWithPlans[]> {
    const results = await this.prisma.planChangeLog.findMany({
      where: { userId },
      include: plansInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return results as PlanChangeLogWithPlans[];
  }

  /**
   * Get the most recent plan change for a user
   */
  async findLatestByUserId(
    userId: string,
  ): Promise<PlanChangeLogWithPlans | null> {
    const result = await this.prisma.planChangeLog.findFirst({
      where: { userId },
      include: plansInclude,
      orderBy: { createdAt: 'desc' },
    });
    return result as PlanChangeLogWithPlans | null;
  }

  /**
   * Get plan changes by type for a user
   */
  async findByUserIdAndType(
    userId: string,
    changeType: PlanChangeType,
  ): Promise<PlanChangeLogWithPlans[]> {
    const results = await this.prisma.planChangeLog.findMany({
      where: { userId, changeType },
      include: plansInclude,
      orderBy: { createdAt: 'desc' },
    });
    return results as PlanChangeLogWithPlans[];
  }
}
