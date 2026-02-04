import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import {
  PlanDto,
  SubscriptionDto,
} from '@modules/subscriptions/dtos/subscription.dto';

// =============================================================================
// Request DTOs
// =============================================================================

export class ChangePlanDto {
  @ApiProperty({
    description: 'Target plan code to change to',
    example: 'pro',
  })
  @IsString()
  @IsNotEmpty()
  planCode: string;
}

export class CancelSubscriptionDto {
  @ApiPropertyOptional({
    description: 'Reason for cancellation',
    example: 'Too expensive',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// =============================================================================
// Resource Overage DTOs
// =============================================================================

export class ResourceOverageDto {
  @ApiProperty({
    description: 'Feature code with overage',
    example: 'accounts',
  })
  featureCode: string;

  @ApiProperty({
    description: 'Current count of resources',
    example: 5,
  })
  current: number;

  @ApiProperty({
    description: 'New limit after plan change',
    example: 2,
  })
  newLimit: number;

  @ApiProperty({
    description: 'Number of resources over the limit',
    example: 3,
  })
  overage: number;

  @ApiProperty({
    description: 'Whether this feature will have a grace period',
    example: true,
  })
  hasGracePeriod: boolean;
}

// =============================================================================
// Preview DTOs
// =============================================================================

export class PlanChangePreviewDto {
  @ApiProperty({
    description: 'Current plan details',
    type: PlanDto,
  })
  currentPlan: PlanDto;

  @ApiProperty({
    description: 'Target plan details',
    type: PlanDto,
  })
  targetPlan: PlanDto;

  @ApiProperty({
    description: 'Type of change',
    enum: ['UPGRADE', 'DOWNGRADE'],
  })
  changeType: 'UPGRADE' | 'DOWNGRADE';

  @ApiProperty({
    description: 'Whether the change is applied immediately',
  })
  immediate: boolean;

  @ApiPropertyOptional({
    description: 'When the change will be applied (for downgrades)',
  })
  effectiveAt?: Date;

  @ApiPropertyOptional({
    description: 'Proration amount (positive = credit, negative = charge)',
    example: 2.5,
  })
  prorationAmount?: number;

  @ApiProperty({
    description: 'Resources that exceed new plan limits',
    type: [ResourceOverageDto],
  })
  overages: ResourceOverageDto[];

  @ApiProperty({
    description: 'Whether there are any overages',
  })
  hasOverages: boolean;

  @ApiPropertyOptional({
    description: 'Grace period end date if there are overages',
  })
  gracePeriodEnd?: Date;
}

export class PreviewResponseDto {
  @ApiProperty({ type: PlanChangePreviewDto })
  preview: PlanChangePreviewDto;
}

// =============================================================================
// Response DTOs
// =============================================================================

export class UpgradeResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Successfully upgraded to Pro plan',
  })
  message: string;

  @ApiProperty({
    description: 'Updated subscription details',
    type: SubscriptionDto,
  })
  subscription: SubscriptionDto;

  @ApiPropertyOptional({
    description: 'Proration amount applied',
  })
  prorationAmount?: number;
}

export class DowngradeResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Downgrade to Free plan scheduled for end of billing period',
  })
  message: string;

  @ApiProperty({
    description: 'Current subscription (plan not changed yet)',
    type: SubscriptionDto,
  })
  subscription: SubscriptionDto;

  @ApiProperty({
    description: 'When the downgrade will be applied',
  })
  scheduledFor: Date;

  @ApiProperty({
    description: 'Target plan code',
  })
  targetPlanCode: string;

  @ApiProperty({
    description: 'Resources that will exceed new plan limits',
    type: [ResourceOverageDto],
  })
  overages: ResourceOverageDto[];

  @ApiPropertyOptional({
    description: 'Grace period end date if there are overages',
  })
  gracePeriodEnd?: Date;
}

export class CancelResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Subscription cancellation scheduled',
  })
  message: string;

  @ApiProperty({
    description: 'When the subscription will be cancelled',
  })
  cancelledAt: Date;

  @ApiProperty({
    description: 'When the subscription will effectively end',
  })
  effectiveAt: Date;
}

export class ReactivateResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Subscription reactivated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Updated subscription details',
    type: SubscriptionDto,
  })
  subscription: SubscriptionDto;
}

export class CancelScheduledChangeResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Scheduled change cancelled successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Updated subscription details',
    type: SubscriptionDto,
  })
  subscription: SubscriptionDto;
}

// =============================================================================
// Plan Change Log DTO
// =============================================================================

export class PlanChangeLogDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fromPlanCode: string;

  @ApiProperty()
  fromPlanName: string;

  @ApiProperty()
  toPlanCode: string;

  @ApiProperty()
  toPlanName: string;

  @ApiProperty({
    enum: [
      'UPGRADE',
      'DOWNGRADE_SCHEDULED',
      'DOWNGRADE_APPLIED',
      'CANCELLATION',
      'CANCELLATION_APPLIED',
      'REACTIVATION',
    ],
  })
  changeType: string;

  @ApiProperty()
  requestedAt: Date;

  @ApiPropertyOptional()
  effectiveAt?: Date;

  @ApiPropertyOptional()
  scheduledFor?: Date;

  @ApiPropertyOptional()
  prorationAmount?: number;

  @ApiPropertyOptional()
  reason?: string;
}

export class PlanChangeHistoryResponseDto {
  @ApiProperty({ type: [PlanChangeLogDto] })
  history: PlanChangeLogDto[];
}
