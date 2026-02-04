import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// =============================================================================
// Plan DTOs
// =============================================================================

export class PlanFeatureDto {
  @ApiProperty({ description: 'Feature code identifier' })
  featureCode: string;

  @ApiProperty({
    enum: ['BOOLEAN', 'COUNT', 'UNLIMITED'],
    description: 'Type of limit',
  })
  limitType: string;

  @ApiProperty({
    description: 'Limit value (-1 for unlimited, 0/1 for boolean)',
  })
  limitValue: number;

  @ApiPropertyOptional({
    enum: ['RESOURCE', 'CONSUMABLE'],
    description: 'Feature type',
  })
  featureType?: string;

  @ApiPropertyOptional({
    enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'],
    description: 'Period for consumable features',
  })
  limitPeriod?: string;
}

export class PlanDto {
  @ApiProperty({ description: 'Plan ID' })
  id: string;

  @ApiProperty({ description: 'Plan code (free, pro, premium)' })
  code: string;

  @ApiProperty({ description: 'Display name' })
  name: string;

  @ApiPropertyOptional({ description: 'Plan description' })
  description?: string;

  @ApiProperty({ description: 'Monthly price' })
  priceMonthly: number;

  @ApiPropertyOptional({ description: 'Yearly price (with discount)' })
  priceYearly?: number;

  @ApiProperty({ description: 'Currency code' })
  priceCurrency: string;

  @ApiProperty({ description: 'Is this the default plan for new users' })
  isDefault: boolean;

  @ApiProperty({ description: 'Sort order for display' })
  sortOrder: number;

  @ApiProperty({
    type: [PlanFeatureDto],
    description: 'Features included in this plan',
  })
  features: PlanFeatureDto[];
}

export class PlansListResponseDto {
  @ApiProperty({ type: [PlanDto] })
  plans: PlanDto[];
}

// =============================================================================
// Subscription DTOs
// =============================================================================

export class SubscriptionDto {
  @ApiProperty({ description: 'Subscription ID' })
  id: string;

  @ApiProperty({ description: 'Subscription status' })
  status: string;

  @ApiProperty({ description: 'Current billing period start' })
  currentPeriodStart: Date;

  @ApiPropertyOptional({
    description: 'Current billing period end (null for free plan)',
  })
  currentPeriodEnd?: Date;

  @ApiPropertyOptional({ description: 'Trial start date' })
  trialStart?: Date;

  @ApiPropertyOptional({ description: 'Trial end date' })
  trialEnd?: Date;

  @ApiProperty({ type: PlanDto, description: 'Current plan details' })
  plan: PlanDto;
}

export class CurrentSubscriptionResponseDto {
  @ApiProperty({ type: SubscriptionDto })
  subscription: SubscriptionDto;
}

// =============================================================================
// Usage DTOs
// =============================================================================

export class FeatureUsageDto {
  @ApiProperty({ description: 'Feature code' })
  featureCode: string;

  @ApiProperty({ description: 'Current usage count' })
  current: number;

  @ApiProperty({ description: 'Maximum allowed (-1 for unlimited)' })
  limit: number;

  @ApiProperty({ description: 'Type of limit' })
  limitType: string;

  @ApiProperty({ description: 'Feature type (RESOURCE or CONSUMABLE)' })
  featureType: string;

  @ApiPropertyOptional({ description: 'Period type for consumable features' })
  periodType?: string;

  @ApiPropertyOptional({
    description: 'Period end date for consumable features',
  })
  periodEnd?: Date;

  @ApiProperty({ description: 'Percentage of limit used (0-100+)' })
  usagePercentage: number;

  @ApiProperty({ description: 'Whether the limit has been reached' })
  limitReached: boolean;
}

export class UsageResponseDto {
  @ApiProperty({ description: 'Plan code' })
  planCode: string;

  @ApiProperty({ description: 'Plan name' })
  planName: string;

  @ApiProperty({
    type: [FeatureUsageDto],
    description: 'Usage details for each feature',
  })
  features: FeatureUsageDto[];
}

// =============================================================================
// Feature Check DTOs (for internal use and guard responses)
// =============================================================================

export class FeatureCheckResultDto {
  @ApiProperty({ description: 'Whether the feature action is allowed' })
  allowed: boolean;

  @ApiPropertyOptional({ description: 'Reason if not allowed' })
  reason?: string;

  @ApiProperty({ description: 'Current usage count' })
  current: number;

  @ApiProperty({ description: 'Maximum allowed (-1 for unlimited)' })
  limit: number;
}

// =============================================================================
// Helper functions to convert entities to DTOs
// =============================================================================

/**
 * Convert Prisma Decimal or similar to number
 * Accepts any object with a toString method (Prisma Decimal, BigInt, etc.)
 */
export function toDecimalNumber(
  value: { toString(): string } | number | null | undefined,
): number | undefined {
  if (value === null || value === undefined) return undefined;
  return typeof value === 'number' ? value : Number(value);
}

export function toPlanDto(plan: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMonthly: { toString(): string } | number;
  priceYearly: { toString(): string } | number | null;
  priceCurrency: string;
  isDefault: boolean;
  sortOrder: number;
  planFeatures: Array<{
    featureCode: string;
    limitType: string;
    limitValue: number;
    featureType: string;
    limitPeriod: string | null;
  }>;
}): PlanDto {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description ?? undefined,
    priceMonthly: toDecimalNumber(plan.priceMonthly) ?? 0,
    priceYearly: toDecimalNumber(plan.priceYearly),
    priceCurrency: plan.priceCurrency,
    isDefault: plan.isDefault,
    sortOrder: plan.sortOrder,
    features: plan.planFeatures.map((f) => ({
      featureCode: f.featureCode,
      limitType: f.limitType,
      limitValue: f.limitValue,
      featureType: f.featureType,
      limitPeriod: f.limitPeriod ?? undefined,
    })),
  };
}
