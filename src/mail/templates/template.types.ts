import { TemplateVariables } from '@mail/providers/mail-provider.interface';

// =============================================================================
// Authentication Templates
// =============================================================================

/**
 * Variables for welcome email template
 *
 * Sent immediately after successful user registration.
 * This is a "thank you for signing up" email, NOT the verification email.
 *
 * @example
 * await mailService.sendTemplate('welcome', user.email, {
 *   userName: 'John Doe',
 *   appName: 'Facets',
 *   loginUrl: 'https://app.facets.com/login',
 * });
 */
export interface WelcomeEmailVariables extends TemplateVariables {
  /** User's display name or first name */
  userName: string;
  /** Application name (typically 'Facets') */
  appName: string;
  /** Direct link to the login page */
  loginUrl: string;
}

/**
 * Variables for email verification template (OTP-based)
 *
 * Sent after registration to verify the user's email address.
 * Contains a 6-digit OTP code that expires after a set time.
 *
 * @example
 * await mailService.sendTemplate('email-verification', user.email, {
 *   userName: 'John',
 *   otpCode: '123456',
 *   expiresInMinutes: 10,
 * });
 */
export interface EmailVerificationVariables extends TemplateVariables {
  /** User's display name or first name */
  userName: string;
  /** 6-digit OTP code for verification */
  otpCode: string;
  /** Minutes until the OTP expires (typically 10) */
  expiresInMinutes: number;
}

/**
 * Variables for password reset email template (OTP-based)
 *
 * Sent when a user requests to reset their password.
 * Contains a 6-digit OTP code that expires after a set time.
 *
 * @example
 * await mailService.sendTemplate('password-reset', user.email, {
 *   userName: 'John',
 *   otpCode: '123456',
 *   expiresInMinutes: 10,
 * });
 */
export interface PasswordResetEmailVariables extends TemplateVariables {
  /** User's display name or first name */
  userName: string;
  /** 6-digit OTP code for password reset */
  otpCode: string;
  /** Minutes until the OTP expires (typically 10) */
  expiresInMinutes: number;
}

// =============================================================================
// Subscription Templates (Phase 4)
// =============================================================================

/**
 * Variables for plan upgraded email template
 *
 * Sent when a user successfully upgrades their plan.
 *
 * @example
 * await mailService.sendTemplate('plan-upgraded', user.email, {
 *   userName: 'John',
 *   previousPlanName: 'Free',
 *   newPlanName: 'Pro',
 *   newPlanPrice: '$4.99/month',
 *   effectiveDate: '2026-02-04',
 * });
 */
export interface PlanUpgradedVariables extends TemplateVariables {
  /** User's display name or first name */
  userName: string;
  /** Name of the previous plan */
  previousPlanName: string;
  /** Name of the new plan */
  newPlanName: string;
  /** Formatted price of the new plan */
  newPlanPrice: string;
  /** Formatted date when the upgrade took effect */
  effectiveDate: string;
}

/**
 * Variables for plan downgrade scheduled email template
 *
 * Sent when a user schedules a downgrade (takes effect at end of billing period).
 *
 * @example
 * await mailService.sendTemplate('plan-downgrade-scheduled', user.email, {
 *   userName: 'John',
 *   currentPlanName: 'Pro',
 *   newPlanName: 'Free',
 *   effectiveDate: '2026-03-04',
 *   overages: [{ feature: 'Accounts', current: 5, newLimit: 2 }],
 * });
 */
export interface PlanDowngradeScheduledVariables extends TemplateVariables {
  /** User's display name or first name */
  userName: string;
  /** Name of the current plan */
  currentPlanName: string;
  /** Name of the new plan after downgrade */
  newPlanName: string;
  /** Formatted date when the downgrade will take effect */
  effectiveDate: string;
  /** List of features that will exceed limits */
  overages: Array<{ feature: string; current: number; newLimit: number }>;
  /** Whether there are any overages */
  hasOverages: boolean;
  /** Grace period end date if there are overages (empty string if none) */
  gracePeriodEnd: string;
}

/**
 * Variables for subscription cancelled email template
 *
 * Sent when a user cancels their subscription.
 *
 * @example
 * await mailService.sendTemplate('subscription-cancelled', user.email, {
 *   userName: 'John',
 *   currentPlanName: 'Pro',
 *   effectiveDate: '2026-03-04',
 * });
 */
export interface SubscriptionCancelledVariables extends TemplateVariables {
  /** User's display name or first name */
  userName: string;
  /** Name of the current plan */
  currentPlanName: string;
  /** Formatted date when the subscription will end */
  effectiveDate: string;
}

/**
 * Variables for grace period warning email template
 *
 * Sent when a user has resources over limit after downgrade
 * and the grace period is about to expire.
 *
 * @example
 * await mailService.sendTemplate('grace-period-warning', user.email, {
 *   userName: 'John',
 *   gracePeriodEnd: '2026-02-11',
 *   daysRemaining: 3,
 *   overages: [{ feature: 'Accounts', current: 5, limit: 2 }],
 * });
 */
export interface GracePeriodWarningVariables extends TemplateVariables {
  /** User's display name or first name */
  userName: string;
  /** Formatted date when the grace period ends */
  gracePeriodEnd: string;
  /** Number of days remaining in grace period */
  daysRemaining: number;
  /** List of features that are over limit */
  overages: Array<{ feature: string; current: number; limit: number }>;
}

/**
 * Variables for grace period expired email template
 *
 * Sent when the grace period has expired and user still has resources over limit.
 *
 * @example
 * await mailService.sendTemplate('grace-period-expired', user.email, {
 *   userName: 'John',
 *   overages: [{ feature: 'Accounts', current: 5, limit: 2 }],
 * });
 */
export interface GracePeriodExpiredVariables extends TemplateVariables {
  /** User's display name or first name */
  userName: string;
  /** List of features that are still over limit */
  overages: Array<{ feature: string; current: number; limit: number }>;
}

// =============================================================================
// Template Variables Map
// =============================================================================

/**
 * Map of template names to their variable types
 *
 * This enables type-safe template sending with autocomplete.
 * When you add a new template, add it here and TypeScript will
 * enforce the correct variables at compile time.
 *
 * @example
 * // TypeScript will enforce correct variables
 * await mailService.sendTemplate('welcome', 'user@example.com', {
 *   userName: 'John',      // ✅ Required
 *   appName: 'Facets',     // ✅ Required
 *   loginUrl: 'https://...' // ✅ Required
 *   // wrongProp: 'value'  // ❌ TypeScript error
 * });
 */
export interface TemplateVariablesMap {
  // Authentication templates
  welcome: WelcomeEmailVariables;
  'email-verification': EmailVerificationVariables;
  'password-reset': PasswordResetEmailVariables;

  // Subscription templates (Phase 4)
  'plan-upgraded': PlanUpgradedVariables;
  'plan-downgrade-scheduled': PlanDowngradeScheduledVariables;
  'subscription-cancelled': SubscriptionCancelledVariables;
  'grace-period-warning': GracePeriodWarningVariables;
  'grace-period-expired': GracePeriodExpiredVariables;
}

/**
 * Union type of all valid template names
 */
export type TemplateName = keyof TemplateVariablesMap;
