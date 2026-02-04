import { SetMetadata } from '@nestjs/common';
import { FeatureCode } from '@modules/subscriptions/constants/features.constant';

/**
 * Metadata key for feature requirements
 */
export const FEATURE_KEY = 'requiredFeature';

/**
 * Options for the RequireFeature decorator
 */
export interface RequireFeatureOptions {
  /**
   * The feature code to check
   */
  feature: FeatureCode;

  /**
   * For RESOURCE features, provide a function that returns the current count
   * This allows the guard to check against actual table counts
   */
  countProvider?: string; // Name of the method on the request to get count
}

/**
 * Decorator to require a specific feature for a route
 *
 * @example
 * // Simple usage for boolean features
 * @RequireFeature(FEATURES.ADVANCED_REPORTS)
 *
 * @example
 * // Usage for count-based features
 * @RequireFeature(FEATURES.ACCOUNTS)
 *
 * The FeatureGuard will:
 * 1. Check if the feature exists in the user's plan
 * 2. For BOOLEAN: check if enabled (limitValue === 1)
 * 3. For COUNT: check if under the limit
 * 4. For UNLIMITED: always allow
 */
export const RequireFeature = (feature: FeatureCode) =>
  SetMetadata(FEATURE_KEY, { feature } as RequireFeatureOptions);
