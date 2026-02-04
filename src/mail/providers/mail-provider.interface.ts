/**
 * Valid template variable value types
 * Compatible with Mailtrap SDK TemplateValue type
 */
export type TemplateVariableValue =
  | string
  | number
  | boolean
  | TemplateVariableValue[]
  | { [key: string]: TemplateVariableValue };

/**
 * Template variables record type
 */
export type TemplateVariables = Record<string, TemplateVariableValue>;

/**
 * Email recipient type
 */
export interface EmailRecipient {
  email: string;
  name?: string;
}

/**
 * Options for sending a simple email (without template)
 */
export interface SendEmailOptions {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Options for sending an email using a template
 */
export interface SendTemplateEmailOptions<T extends TemplateVariables> {
  to: EmailRecipient | EmailRecipient[];
  templateId: string;
  variables: T;
}

/**
 * Contract that any email provider must implement
 *
 * This interface enables easy switching between providers (Mailtrap, SendGrid, Resend, etc.)
 * without changing the business logic code.
 */
export interface MailProvider {
  /**
   * Send a simple email with plain text or HTML content
   */
  send(options: SendEmailOptions): Promise<void>;

  /**
   * Send an email using a pre-defined template
   */
  sendTemplate<T extends TemplateVariables>(
    options: SendTemplateEmailOptions<T>,
  ): Promise<void>;
}

/**
 * Dependency injection token for the mail provider
 */
export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');
