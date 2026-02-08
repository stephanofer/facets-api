import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SubscriptionsService } from '@modules/subscriptions/subscriptions.service';
import { PlanManagementService } from '@modules/subscriptions/plan-management.service';
import {
  CurrentSubscriptionResponseDto,
  UsageResponseDto,
} from '@modules/subscriptions/dtos/subscription.dto';
import {
  ChangePlanDto,
  CancelSubscriptionDto,
  PreviewResponseDto,
  UpgradeResponseDto,
  DowngradeResponseDto,
  CancelResponseDto,
  ReactivateResponseDto,
  CancelScheduledChangeResponseDto,
  PlanChangeHistoryResponseDto,
} from '@modules/subscriptions/dtos/plan-management.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly planManagementService: PlanManagementService,
  ) {}

  // ==========================================================================
  // Phase 3: Basic Subscription Endpoints
  // ==========================================================================

  /**
   * Get current user's subscription
   */
  @Get('current')
  @ApiOperation({
    summary: 'Get current subscription',
    description:
      "Get the current user's subscription details including plan and status.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current subscription details',
    type: CurrentSubscriptionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No active subscription found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  async getCurrentSubscription(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CurrentSubscriptionResponseDto> {
    const subscription = await this.subscriptionsService.getUserSubscription(
      user.sub,
    );
    return { subscription };
  }

  /**
   * Get current usage for all features
   */
  @Get('usage')
  @ApiOperation({
    summary: 'Get usage statistics',
    description:
      "Get the current usage for all features in the user's plan. Shows current count, limits, and percentage used.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Usage statistics for all features',
    type: UsageResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No active subscription found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  async getUsage(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UsageResponseDto> {
    return this.subscriptionsService.getUserUsage(user.sub);
  }

  // ==========================================================================
  // Phase 4: Plan Management Endpoints
  // ==========================================================================

  /**
   * Preview plan change effects
   */
  @Get('preview')
  @ApiOperation({
    summary: 'Preview plan change',
    description:
      'Preview the effects of changing to a different plan. Shows pricing, overages, and effective dates.',
  })
  @ApiQuery({
    name: 'planCode',
    description: 'Target plan code (e.g., "pro", "premium", "free")',
    example: 'pro',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Plan change preview',
    type: PreviewResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription or plan not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Already on this plan',
  })
  async previewPlanChange(
    @CurrentUser() user: AuthenticatedUser,
    @Query('planCode') planCode: string,
  ): Promise<PreviewResponseDto> {
    const preview = await this.planManagementService.previewPlanChange(
      user.sub,
      planCode,
    );
    return { preview };
  }

  /**
   * Upgrade to a higher plan (immediate)
   */
  @Post('upgrade')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upgrade plan',
    description:
      'Upgrade to a higher tier plan. The change takes effect immediately and proration is applied.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Plan upgraded successfully',
    type: UpgradeResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription or plan not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid upgrade (same plan or lower tier)',
  })
  async upgradePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePlanDto,
  ): Promise<UpgradeResponseDto> {
    return this.planManagementService.upgradePlan(
      user.sub,
      dto.planCode,
      user.email,
    );
  }

  /**
   * Downgrade to a lower plan (scheduled)
   */
  @Post('downgrade')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Downgrade plan',
    description:
      'Downgrade to a lower tier plan. The change is scheduled for the end of the current billing period.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Downgrade scheduled successfully',
    type: DowngradeResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription or plan not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid downgrade (same plan or higher tier)',
  })
  async downgradePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePlanDto,
  ): Promise<DowngradeResponseDto> {
    return this.planManagementService.downgradePlan(
      user.sub,
      dto.planCode,
      user.email,
    );
  }

  /**
   * Cancel subscription
   */
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel subscription',
    description:
      'Cancel the subscription. The user will be downgraded to the Free plan at the end of the billing period.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cancellation scheduled successfully',
    type: CancelResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No active subscription found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot cancel free plan or already cancelled',
  })
  async cancelSubscription(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CancelSubscriptionDto,
  ): Promise<CancelResponseDto> {
    return this.planManagementService.cancelSubscription(
      user.sub,
      dto.reason,
      user.email,
    );
  }

  /**
   * Reactivate a cancelled subscription
   */
  @Post('reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reactivate subscription',
    description:
      'Reactivate a cancelled subscription before the cancellation takes effect.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription reactivated successfully',
    type: ReactivateResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No active subscription found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'No pending cancellation to reactivate',
  })
  async reactivateSubscription(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReactivateResponseDto> {
    return this.planManagementService.reactivateSubscription(user.sub);
  }

  /**
   * Cancel a scheduled change (downgrade or cancellation)
   */
  @Delete('scheduled')
  @ApiOperation({
    summary: 'Cancel scheduled change',
    description:
      'Cancel a scheduled downgrade or cancellation. The subscription will remain on the current plan.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Scheduled change cancelled successfully',
    type: CancelScheduledChangeResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No active subscription found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'No scheduled change to cancel',
  })
  async cancelScheduledChange(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CancelScheduledChangeResponseDto> {
    return this.planManagementService.cancelScheduledChange(user.sub);
  }

  /**
   * Get plan change history
   */
  @Get('history')
  @ApiOperation({
    summary: 'Get plan change history',
    description: 'Get a list of all plan changes for the current user.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of records to return (default: 20)',
    example: 20,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Plan change history',
    type: PlanChangeHistoryResponseDto,
  })
  async getPlanChangeHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: number,
  ): Promise<PlanChangeHistoryResponseDto> {
    const history = await this.planManagementService.getPlanChangeHistory(
      user.sub,
      limit ? Number(limit) : undefined,
    );
    return { history };
  }
}
