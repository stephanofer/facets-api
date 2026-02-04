import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { Plan, PlanFeature } from '../../../generated/prisma/client';

export interface PlanWithFeatures extends Plan {
  planFeatures: PlanFeature[];
}

@Injectable()
export class PlansRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all active plans ordered by sortOrder
   */
  async findAllActive(): Promise<PlanWithFeatures[]> {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      include: { planFeatures: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Find a plan by its code (e.g., 'free', 'pro', 'premium')
   */
  async findByCode(code: string): Promise<PlanWithFeatures | null> {
    return this.prisma.plan.findUnique({
      where: { code },
      include: { planFeatures: true },
    });
  }

  /**
   * Find a plan by its ID
   */
  async findById(id: string): Promise<PlanWithFeatures | null> {
    return this.prisma.plan.findUnique({
      where: { id },
      include: { planFeatures: true },
    });
  }

  /**
   * Find the default plan (isDefault = true)
   */
  async findDefault(): Promise<PlanWithFeatures | null> {
    return this.prisma.plan.findFirst({
      where: { isDefault: true, isActive: true },
      include: { planFeatures: true },
    });
  }

  /**
   * Get a specific feature for a plan
   */
  async getFeature(
    planId: string,
    featureCode: string,
  ): Promise<PlanFeature | null> {
    return this.prisma.planFeature.findUnique({
      where: {
        planId_featureCode: {
          planId,
          featureCode,
        },
      },
    });
  }
}
