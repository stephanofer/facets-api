import { Controller, Get, Param, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SubscriptionsService } from '@modules/subscriptions/subscriptions.service';
import {
  PlanDto,
  PlansListResponseDto,
} from '@modules/subscriptions/dtos/subscription.dto';
import { Public } from '@common/decorators/public.decorator';

@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * Get all available plans
   */
  @Public()
  @Get()
  @ApiOperation({
    summary: 'List all plans',
    description:
      'Get all available subscription plans with their features and pricing.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of all active plans',
    type: PlansListResponseDto,
  })
  async getAllPlans(): Promise<PlansListResponseDto> {
    const plans = await this.subscriptionsService.getAllPlans();
    return { plans };
  }

  /**
   * Get a specific plan by code
   */
  @Public()
  @Get(':code')
  @ApiOperation({
    summary: 'Get plan details',
    description: 'Get detailed information about a specific plan by its code.',
  })
  @ApiParam({
    name: 'code',
    description: 'Plan code (free, pro, premium)',
    example: 'pro',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Plan details',
    type: PlanDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Plan not found',
  })
  async getPlanByCode(@Param('code') code: string): Promise<PlanDto> {
    return this.subscriptionsService.getPlanByCode(code);
  }
}
