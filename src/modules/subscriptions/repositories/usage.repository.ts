import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { UsageRecord, LimitPeriod } from '../../../generated/prisma/client';
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  endOfDay,
  endOfWeek,
  endOfMonth,
  endOfYear,
} from '@common/utils/date.utils';

@Injectable()
export class UsageRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get or create a usage record for the current period
   */
  async getOrCreateForPeriod(
    userId: string,
    featureCode: string,
    periodType: LimitPeriod,
  ): Promise<UsageRecord> {
    const { periodStart, periodEnd } = this.getCurrentPeriod(periodType);

    // Try to find existing record
    const existing = await this.prisma.usageRecord.findUnique({
      where: {
        userId_featureCode_periodStart: {
          userId,
          featureCode,
          periodStart,
        },
      },
    });

    if (existing) {
      return existing;
    }

    // Create new record for this period
    return this.prisma.usageRecord.create({
      data: {
        userId,
        featureCode,
        periodType,
        periodStart,
        periodEnd,
        count: 0,
      },
    });
  }

  /**
   * Get current usage for a feature in the current period
   */
  async getCurrentUsage(
    userId: string,
    featureCode: string,
    periodType: LimitPeriod,
  ): Promise<number> {
    const { periodStart } = this.getCurrentPeriod(periodType);

    const record = await this.prisma.usageRecord.findUnique({
      where: {
        userId_featureCode_periodStart: {
          userId,
          featureCode,
          periodStart,
        },
      },
      select: { count: true },
    });

    return record?.count ?? 0;
  }

  /**
   * Increment usage count by a specified amount
   */
  async incrementUsage(
    userId: string,
    featureCode: string,
    periodType: LimitPeriod,
    amount: number = 1,
  ): Promise<UsageRecord> {
    const { periodStart, periodEnd } = this.getCurrentPeriod(periodType);

    return this.prisma.usageRecord.upsert({
      where: {
        userId_featureCode_periodStart: {
          userId,
          featureCode,
          periodStart,
        },
      },
      update: {
        count: { increment: amount },
        updatedAt: new Date(),
      },
      create: {
        userId,
        featureCode,
        periodType,
        periodStart,
        periodEnd,
        count: amount,
      },
    });
  }

  /**
   * Decrement usage count (useful for refunds or adjustments)
   * Note: For CONSUMABLE features, deletion does NOT restore usage
   * This method is mainly for administrative corrections
   */
  async decrementUsage(
    userId: string,
    featureCode: string,
    periodType: LimitPeriod,
    amount: number = 1,
  ): Promise<UsageRecord | null> {
    const { periodStart } = this.getCurrentPeriod(periodType);

    const existing = await this.prisma.usageRecord.findUnique({
      where: {
        userId_featureCode_periodStart: {
          userId,
          featureCode,
          periodStart,
        },
      },
    });

    if (!existing) {
      return null;
    }

    // Don't go below 0
    const newCount = Math.max(0, existing.count - amount);

    return this.prisma.usageRecord.update({
      where: { id: existing.id },
      data: {
        count: newCount,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get all usage records for a user in current periods
   */
  async getAllCurrentUsage(userId: string): Promise<UsageRecord[]> {
    // Get usage for all period types that might be active
    const now = new Date();

    return this.prisma.usageRecord.findMany({
      where: {
        userId,
        periodEnd: { gte: now },
      },
      orderBy: { featureCode: 'asc' },
    });
  }

  /**
   * Calculate period start and end dates based on period type
   */
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
        // Default to monthly
        return {
          periodStart: startOfMonth(now),
          periodEnd: endOfMonth(now),
        };
    }
  }
}
