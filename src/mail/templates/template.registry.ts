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
};
