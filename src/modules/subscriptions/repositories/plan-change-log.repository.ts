import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/client';
import { PrismaService } from '@database/prisma.service';
import { Plan, PlanChangeType, Prisma } from '../../../generated/prisma/client';

export interface PlanChangeLogBase {
  id: string;
  workspaceId: string;
  requestedByUserId: string | null;
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
  workspaceId: string;
  requestedByUserId?: string;
  fromPlanId: string;
  toPlanId: string;
  changeType: PlanChangeType;
  effectiveAt?: Date;
  scheduledFor?: Date;
  prorationAmount?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

const plansInclude = {
  fromPlan: true,
  toPlan: true,
} as const;

@Injectable()
export class PlanChangeLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreatePlanChangeLogData): Promise<PlanChangeLogWithPlans> {
    const result = await this.prisma.planChangeLog.create({
      data: {
        workspaceId: data.workspaceId,
        requestedByUserId: data.requestedByUserId,
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

  async findByWorkspaceId(
    workspaceId: string,
    limit: number = 20,
  ): Promise<PlanChangeLogWithPlans[]> {
    const results = await this.prisma.planChangeLog.findMany({
      where: { workspaceId },
      include: plansInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return results as PlanChangeLogWithPlans[];
  }

  async findLatestByWorkspaceId(
    workspaceId: string,
  ): Promise<PlanChangeLogWithPlans | null> {
    const result = await this.prisma.planChangeLog.findFirst({
      where: { workspaceId },
      include: plansInclude,
      orderBy: { createdAt: 'desc' },
    });

    return result as PlanChangeLogWithPlans | null;
  }

  async findByWorkspaceIdAndType(
    workspaceId: string,
    changeType: PlanChangeType,
  ): Promise<PlanChangeLogWithPlans[]> {
    const results = await this.prisma.planChangeLog.findMany({
      where: { workspaceId, changeType },
      include: plansInclude,
      orderBy: { createdAt: 'desc' },
    });

    return results as PlanChangeLogWithPlans[];
  }
}
