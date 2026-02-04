import { TemplateName } from '@mail/templates/template.types';

/**
 * Registry of template names to Mailtrap template UUIDs
 *
 * Template UUIDs are obtained from the Mailtrap dashboard:
 * https://mailtrap.io/sending/templates
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * HOW TO CREATE A TEMPLATE IN MAILTRAP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 1. Go to: https://mailtrap.io/sending/templates
 * 2. Click "Create New Template"
 * 3. Choose "Code your own" for full control (or use their visual editor)
 * 4. Use Handlebars syntax for variables: {{variableName}}
 * 5. Save and copy the UUID from the template URL or settings
 * 6. Replace the placeholder UUID here with the real one
 *
 * IMPORTANT: Reference HTML templates are available in:
 * src/mail/templates/html/
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * VARIABLE REFERENCE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * welcome:
 *   - {{userName}}         User's display name
 *   - {{appName}}          Application name (Facets)
 *   - {{loginUrl}}         Login page URL
 *
 * email-verification:
 *   - {{userName}}         User's display name
 *   - {{otpCode}}          6-digit verification code
 *   - {{expiresInMinutes}} Minutes until expiration (typically 10)
 *
 * password-reset:
 *   - {{userName}}         User's display name
 *   - {{otpCode}}          6-digit reset code
 *   - {{expiresInMinutes}} Minutes until expiration (typically 10)
 *
 * plan-upgraded:
 *   - {{userName}}         User's display name
 *   - {{previousPlanName}} Previous plan name
 *   - {{newPlanName}}      New plan name
 *   - {{newPlanPrice}}     Formatted price of new plan
 *   - {{effectiveDate}}    Date when upgrade took effect
 *
 * plan-downgrade-scheduled:
 *   - {{userName}}         User's display name
 *   - {{currentPlanName}}  Current plan name
 *   - {{newPlanName}}      New plan name after downgrade
 *   - {{effectiveDate}}    Date when downgrade takes effect
 *   - {{overages}}         Array of { feature, current, newLimit }
 *   - {{hasOverages}}      Boolean if there are overages
 *   - {{gracePeriodEnd}}   Grace period end date (empty if no overages)
 *
 * subscription-cancelled:
 *   - {{userName}}         User's display name
 *   - {{currentPlanName}}  Current plan name
 *   - {{effectiveDate}}    Date when subscription ends
 *
 * grace-period-warning:
 *   - {{userName}}         User's display name
 *   - {{gracePeriodEnd}}   Grace period end date
 *   - {{daysRemaining}}    Days remaining in grace period
 *   - {{overages}}         Array of { feature, current, limit }
 *
 * grace-period-expired:
 *   - {{userName}}         User's display name
 *   - {{overages}}         Array of { feature, current, limit }
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export const TEMPLATE_IDS: Record<TemplateName, string> = {
  // ===========================================================================
  // Authentication Templates
  // ===========================================================================

  /**
   * Welcome email - Sent after successful registration
   *
   * Purpose: Thank the user for signing up and provide login link
   * Trigger: After user completes registration (before email verification)
   *
   * Variables: userName, appName, loginUrl
   */
  welcome: 'd23ffdac-317d-45e3-b24a-c5f3d30dc7c7',

  /**
   * Email verification - Sent to verify user's email address
   *
   * Purpose: Confirm email ownership with 6-digit OTP code
   * Trigger: After registration, or when user requests resend
   *
   * Variables: userName, otpCode, expiresInMinutes
   */
  'email-verification': 'c3222a19-d663-4c31-8d59-c34a3c5fe734',

  /**
   * Password reset - Sent when user requests password recovery
   *
   * Purpose: Provide 6-digit OTP code to reset password
   * Trigger: When user submits forgot-password request
   *
   * Variables: userName, otpCode, expiresInMinutes
   */
  'password-reset': '53e5a8ac-ca30-4860-acb3-dc717f87f74c',

  // ===========================================================================
  // Subscription Templates (Phase 4)
  // ===========================================================================

  /**
   * Plan upgraded - Sent after successful plan upgrade
   *
   * Purpose: Confirm the plan upgrade and show new features
   * Trigger: When user upgrades their plan (immediate effect)
   *
   * Variables: userName, previousPlanName, newPlanName, newPlanPrice, effectiveDate
   */
  'plan-upgraded': 'PLACEHOLDER_PLAN_UPGRADED_UUID',

  /**
   * Plan downgrade scheduled - Sent when downgrade is scheduled
   *
   * Purpose: Confirm the downgrade is scheduled for end of billing period
   * Trigger: When user downgrades their plan
   *
   * Variables: userName, currentPlanName, newPlanName, effectiveDate, overages, hasOverages, gracePeriodEnd
   */
  'plan-downgrade-scheduled': 'PLACEHOLDER_PLAN_DOWNGRADE_SCHEDULED_UUID',

  /**
   * Subscription cancelled - Sent when subscription is cancelled
   *
   * Purpose: Confirm cancellation and when it takes effect
   * Trigger: When user cancels their subscription
   *
   * Variables: userName, currentPlanName, effectiveDate
   */
  'subscription-cancelled': 'PLACEHOLDER_SUBSCRIPTION_CANCELLED_UUID',

  /**
   * Grace period warning - Sent when grace period is about to expire
   *
   * Purpose: Warn user that they need to reduce resources before grace period ends
   * Trigger: A few days before grace period expires (via cron job)
   *
   * Variables: userName, gracePeriodEnd, daysRemaining, overages
   */
  'grace-period-warning': 'PLACEHOLDER_GRACE_PERIOD_WARNING_UUID',

  /**
   * Grace period expired - Sent when grace period has expired
   *
   * Purpose: Notify user that grace period has expired
   * Trigger: When grace period expires (via cron job)
   *
   * Variables: userName, overages
   */
  'grace-period-expired': 'PLACEHOLDER_GRACE_PERIOD_EXPIRED_UUID',
};
