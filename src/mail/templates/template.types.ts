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
}

/**
 * Union type of all valid template names
 */
export type TemplateName = keyof TemplateVariablesMap;
