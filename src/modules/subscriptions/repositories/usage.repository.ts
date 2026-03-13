import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { LimitPeriod, UsageRecord } from '../../../generated/prisma/client';
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from '@common/utils/date.utils';

@Injectable()
export class UsageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateForPeriod(
    workspaceId: string,
    featureCode: string,
    periodType: LimitPeriod,
  ): Promise<UsageRecord> {
    const { periodStart, periodEnd } = this.getCurrentPeriod(periodType);

    const existing = await this.prisma.usageRecord.findUnique({
      where: {
        workspaceId_featureCode_periodStart: {
          workspaceId,
          featureCode,
          periodStart,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.usageRecord.create({
      data: {
        workspaceId,
        featureCode,
        periodType,
        periodStart,
        periodEnd,
        count: 0,
      },
    });
  }

  async getCurrentUsage(
    workspaceId: string,
    featureCode: string,
    periodType: LimitPeriod,
  ): Promise<number> {
    const { periodStart } = this.getCurrentPeriod(periodType);

    const record = await this.prisma.usageRecord.findUnique({
      where: {
        workspaceId_featureCode_periodStart: {
          workspaceId,
          featureCode,
          periodStart,
        },
      },
      select: { count: true },
    });

    return record?.count ?? 0;
  }

  async incrementUsage(
    workspaceId: string,
    featureCode: string,
    periodType: LimitPeriod,
    amount: number = 1,
  ): Promise<UsageRecord> {
    const { periodStart, periodEnd } = this.getCurrentPeriod(periodType);

    return this.prisma.usageRecord.upsert({
      where: {
        workspaceId_featureCode_periodStart: {
          workspaceId,
          featureCode,
          periodStart,
        },
      },
      update: {
        count: { increment: amount },
        updatedAt: new Date(),
      },
      create: {
        workspaceId,
        featureCode,
        periodType,
        periodStart,
        periodEnd,
        count: amount,
      },
    });
  }

  async decrementUsage(
    workspaceId: string,
    featureCode: string,
    periodType: LimitPeriod,
    amount: number = 1,
  ): Promise<UsageRecord | null> {
    const { periodStart } = this.getCurrentPeriod(periodType);

    const existing = await this.prisma.usageRecord.findUnique({
      where: {
        workspaceId_featureCode_periodStart: {
          workspaceId,
          featureCode,
          periodStart,
        },
      },
    });

    if (!existing) {
      return null;
    }

    const newCount = Math.max(0, existing.count - amount);

    return this.prisma.usageRecord.update({
      where: { id: existing.id },
      data: {
        count: newCount,
        updatedAt: new Date(),
      },
    });
  }

  async getAllCurrentUsage(workspaceId: string): Promise<UsageRecord[]> {
    const now = new Date();

    return this.prisma.usageRecord.findMany({
      where: {
        workspaceId,
        periodEnd: { gte: now },
      },
      orderBy: { featureCode: 'asc' },
    });
  }

  private getCurrentPeriod(periodType: LimitPeriod): {
    periodStart: Date;
    periodEnd: Date;
  } {
    const now = new Date();

    switch (periodType) {
      case LimitPeriod.DAILY:
        return {
          periodStart: startOfDay(now),
          periodEnd: endOfDay(now),
        };
      case LimitPeriod.WEEKLY:
        return {
          periodStart: startOfWeek(now),
          periodEnd: endOfWeek(now),
        };
      case LimitPeriod.MONTHLY:
        return {
          periodStart: startOfMonth(now),
          periodEnd: endOfMonth(now),
        };
      case LimitPeriod.YEARLY:
        return {
          periodStart: startOfYear(now),
          periodEnd: endOfYear(now),
        };
      default:
        return {
          periodStart: startOfMonth(now),
          periodEnd: endOfMonth(now),
        };
    }
  }
}
