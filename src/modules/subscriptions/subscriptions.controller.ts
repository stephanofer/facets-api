import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '@common/decorators/current-principal.decorator';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import {
  CancelResponseDto,
  CancelScheduledChangeResponseDto,
  CancelSubscriptionDto,
  ChangePlanDto,
  DowngradeResponseDto,
  PlanChangeHistoryResponseDto,
  PreviewResponseDto,
  ReactivateResponseDto,
  UpgradeResponseDto,
} from '@modules/subscriptions/dtos/plan-management.dto';
import {
  CurrentSubscriptionResponseDto,
  UsageResponseDto,
} from '@modules/subscriptions/dtos/subscription.dto';
import { RequireWorkspaceRole } from '@common/decorators/workspace-role.decorator';
import { PlanManagementService } from '@modules/subscriptions/plan-management.service';
import { SubscriptionsService } from '@modules/subscriptions/subscriptions.service';
import { WorkspaceRole } from '../../generated/prisma/client';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly planManagementService: PlanManagementService,
  ) {}

  @Get('current')
  @ApiOperation({
    summary: 'Get current subscription',
    description:
      'Get the current workspace subscription details including plan and status.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current subscription details',
    type: CurrentSubscriptionResponseDto,
  })
  async getCurrentSubscription(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<CurrentSubscriptionResponseDto> {
    const subscription =
      await this.subscriptionsService.getWorkspaceSubscription(
        principal.workspaceId,
      );

    return { subscription };
  }

  @Get('usage')
  @ApiOperation({
    summary: 'Get usage statistics',
    description:
      'Get the current usage for all features in the active workspace plan.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Usage statistics for all features',
    type: UsageResponseDto,
  })
  async getUsage(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<UsageResponseDto> {
    return this.subscriptionsService.getWorkspaceUsage(principal.workspaceId);
  }

  @Get('preview')
  @ApiOperation({
    summary: 'Preview plan change',
    description:
      'Preview the effects of changing to a different plan for the active workspace.',
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
  @RequireWorkspaceRole(WorkspaceRole.ADMIN)
  async previewPlanChange(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('planCode') planCode: string,
  ): Promise<PreviewResponseDto> {
    const preview = await this.planManagementService.previewPlanChange(
      principal,
      planCode,
    );

    return { preview };
  }

  @Post('upgrade')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upgrade plan',
    description:
      'Upgrade the active workspace to a higher tier plan. The change takes effect immediately.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Plan upgraded successfully',
    type: UpgradeResponseDto,
  })
  @RequireWorkspaceRole(WorkspaceRole.ADMIN)
  async upgradePlan(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: ChangePlanDto,
  ): Promise<UpgradeResponseDto> {
    return this.planManagementService.upgradePlan(principal, dto.planCode);
  }

  @Post('downgrade')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Downgrade plan',
    description:
      'Downgrade the active workspace to a lower tier plan. The change is scheduled for the end of the current billing period.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Downgrade scheduled successfully',
    type: DowngradeResponseDto,
  })
  @RequireWorkspaceRole(WorkspaceRole.ADMIN)
  async downgradePlan(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: ChangePlanDto,
  ): Promise<DowngradeResponseDto> {
    return this.planManagementService.downgradePlan(principal, dto.planCode);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel subscription',
    description:
      'Cancel the active workspace subscription. It will downgrade to Free at the end of the billing period.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cancellation scheduled successfully',
    type: CancelResponseDto,
  })
  @RequireWorkspaceRole(WorkspaceRole.ADMIN)
  async cancelSubscription(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CancelSubscriptionDto,
  ): Promise<CancelResponseDto> {
    return this.planManagementService.cancelSubscription(principal, dto.reason);
  }

  @Post('reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reactivate subscription',
    description:
      'Reactivate a cancelled active workspace subscription before cancellation takes effect.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription reactivated successfully',
    type: ReactivateResponseDto,
  })
  @RequireWorkspaceRole(WorkspaceRole.ADMIN)
  async reactivateSubscription(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<ReactivateResponseDto> {
    return this.planManagementService.reactivateSubscription(principal);
  }

  @Delete('scheduled')
  @ApiOperation({
    summary: 'Cancel scheduled change',
    description:
      'Cancel a scheduled downgrade or cancellation for the active workspace.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Scheduled change cancelled successfully',
    type: CancelScheduledChangeResponseDto,
  })
  @RequireWorkspaceRole(WorkspaceRole.ADMIN)
  async cancelScheduledChange(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<CancelScheduledChangeResponseDto> {
    return this.planManagementService.cancelScheduledChange(principal);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get plan change history',
    description: 'Get a list of all plan changes for the active workspace.',
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
  @RequireWorkspaceRole(WorkspaceRole.ADMIN)
  async getPlanChangeHistory(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('limit') limit?: number,
  ): Promise<PlanChangeHistoryResponseDto> {
    const history = await this.planManagementService.getPlanChangeHistory(
      principal,
      limit ? Number(limit) : undefined,
    );

    return { history };
  }
}
