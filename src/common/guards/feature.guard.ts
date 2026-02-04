import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  FEATURE_KEY,
  RequireFeatureOptions,
} from '@common/decorators/feature.decorator';
import { SubscriptionsService } from '@modules/subscriptions/subscriptions.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_CODES } from '@common/constants/app.constants';
import { FeatureLimitType, FeatureType } from '../../generated/prisma/client';

/**
 * Guard that checks if the user has access to a specific feature
 *
 * This guard is used with the @RequireFeature decorator to protect routes
 * based on the user's subscription plan.
 *
 * @example
 * // In a controller
 * @UseGuards(FeatureGuard)
 * @RequireFeature(FEATURES.ADVANCED_REPORTS)
 * @Get('reports')
 * async getAdvancedReports() { ... }
 *
 * For count-based features, the guard will check if the user is under their limit.
 * The actual resource count should be provided via a service or the request context.
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get the feature requirement from decorator
    const featureOptions =
      this.reflector.getAllAndOverride<RequireFeatureOptions>(FEATURE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    // If no feature requirement, allow access
    if (!featureOptions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Must be authenticated
    if (!user?.sub) {
      throw new BusinessException(
        ERROR_CODES.UNAUTHORIZED,
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const userId = user.sub;
    const { feature } = featureOptions;

    // Get the feature limit from user's plan
    const planFeature = await this.subscriptionsService.getFeatureLimit(
      userId,
      feature,
    );

    // Feature not in plan
    if (!planFeature) {
      throw new BusinessException(
        ERROR_CODES.FEATURE_NOT_AVAILABLE,
        `Feature '${feature}' is not available in your current plan`,
        HttpStatus.FORBIDDEN,
      );
    }

    // Check based on limit type
    switch (planFeature.limitType) {
      case FeatureLimitType.UNLIMITED:
        // Always allow unlimited features
        return true;

      case FeatureLimitType.BOOLEAN:
        // Check if feature is enabled
        if (planFeature.limitValue !== 1) {
          throw new BusinessException(
            ERROR_CODES.FEATURE_NOT_AVAILABLE,
            `Feature '${feature}' is not available in your current plan. Please upgrade to access this feature.`,
            HttpStatus.FORBIDDEN,
          );
        }
        return true;

      case FeatureLimitType.COUNT:
        // For count-based features, we need to check differently based on feature type
        // RESOURCE: The actual check will happen in the service (we can't count here)
        // CONSUMABLE: We can check the usage record
        if (planFeature.featureType === FeatureType.CONSUMABLE) {
          const checkResult =
            await this.subscriptionsService.checkFeatureAccess(userId, feature);

          if (!checkResult.allowed) {
            throw new BusinessException(
              ERROR_CODES.FEATURE_LIMIT_EXCEEDED,
              `You have reached your limit for '${feature}' (${checkResult.current}/${checkResult.limit}). Please upgrade your plan for more.`,
              HttpStatus.FORBIDDEN,
              [
                {
                  feature,
                  current: checkResult.current,
                  limit: checkResult.limit,
                },
              ],
            );
          }
        }
        // For RESOURCE type, we allow the request to proceed
        // The service layer should call checkFeatureAccess with the actual count
        return true;

      default:
        return true;
    }
  }
}
