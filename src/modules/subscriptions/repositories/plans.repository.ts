import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '@database/prisma.service';
import { Plan, PlanFeature } from '../../../generated/prisma/client';

export interface PlanWithFeatures extends Plan {
  planFeatures: PlanFeature[];
}

/** Cache TTL for plan data (5 minutes) */
const PLANS_CACHE_TTL = 300_000;

/** Cache key constants */
const CACHE_KEYS = {
  ALL_ACTIVE: 'plans:all-active',
  BY_CODE: (code: string) => `plans:code:${code}`,
  DEFAULT: 'plans:default',
} as const;

@Injectable()
export class PlansRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /**
   * Find all active plans ordered by sortOrder (cached)
   */
  async findAllActive(): Promise<PlanWithFeatures[]> {
    const cached = await this.cache.get<PlanWithFeatures[]>(
      CACHE_KEYS.ALL_ACTIVE,
    );
    if (cached) return cached;

    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      include: { planFeatures: true },
      orderBy: { sortOrder: 'asc' },
    });

    await this.cache.set(CACHE_KEYS.ALL_ACTIVE, plans, PLANS_CACHE_TTL);
    return plans;
  }

  /**
   * Find a plan by its code (e.g., 'free', 'pro', 'premium') (cached)
   */
  async findByCode(code: string): Promise<PlanWithFeatures | null> {
    const cacheKey = CACHE_KEYS.BY_CODE(code);
    const cached = await this.cache.get<PlanWithFeatures | null>(cacheKey);
    if (cached !== undefined) return cached;

    const plan = await this.prisma.plan.findUnique({
      where: { code },
      include: { planFeatures: true },
    });

    if (plan) {
      await this.cache.set(cacheKey, plan, PLANS_CACHE_TTL);
    }
    return plan;
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
   * Find the default plan (isDefault = true) (cached)
   */
  async findDefault(): Promise<PlanWithFeatures | null> {
    const cached = await this.cache.get<PlanWithFeatures | null>(
      CACHE_KEYS.DEFAULT,
    );
    if (cached !== undefined) return cached;

    const plan = await this.prisma.plan.findFirst({
      where: { isDefault: true, isActive: true },
      include: { planFeatures: true },
    });

    if (plan) {
      await this.cache.set(CACHE_KEYS.DEFAULT, plan, PLANS_CACHE_TTL);
    }
    return plan;
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

  /**
   * Invalidate all plan caches
   *
   * Call this when plans are created, updated, or deactivated.
   */
  async invalidateCache(): Promise<void> {
    await Promise.all([
      this.cache.del(CACHE_KEYS.ALL_ACTIVE),
      this.cache.del(CACHE_KEYS.DEFAULT),
    ]);
    // Note: individual plan code caches will expire naturally via TTL.
    // For immediate invalidation of specific plans, call cache.del(CACHE_KEYS.BY_CODE(code)).
  }
}
