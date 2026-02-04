import { Inject, Injectable } from '@nestjs/common';

import {
  MAIL_PROVIDER,
  MailProvider,
  EmailRecipient,
  TemplateVariables,
} from '@mail/providers/mail-provider.interface';
import { TEMPLATE_IDS } from '@mail/templates/template.registry';
import {
  TemplateName,
  TemplateVariablesMap,
} from '@mail/templates/template.types';

/**
 * High-level email service for sending emails
 *
 * This service provides type-safe methods for sending emails with templates.
 * It abstracts away the underlying provider implementation, allowing easy
 * switching between Mailtrap, SendGrid, Resend, etc.
 *
 * @example
 * // Sending a typed template email
 * await mailService.sendTemplate('welcome', 'user@example.com', {
 *   userName: 'John',
 *   appName: 'Facets',
 *   loginUrl: 'https://app.facets.com/login',
 * });
 *
 * // TypeScript will enforce correct variables for each template
 * await mailService.sendTemplate('password-reset', user.email, {
 *   userName: user.name,
 *   resetUrl: `https://app.facets.com/reset?token=${token}`,
 *   expiresInMinutes: 30,
 * });
 */
@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_PROVIDER)
    private readonly mailProvider: MailProvider,
  ) {}

  /**
   * Send an email using a typed template
   *
   * Template variables are enforced by TypeScript based on the template name.
   * See `TemplateVariablesMap` in template.types.ts for available templates.
   *
   * @param template - The template name (must be a key in TemplateVariablesMap)
   * @param to - Recipient email(s) - can be string, EmailRecipient, or array
   * @param variables - Template variables (type-checked based on template)
   *
   * @example
   * // Single recipient with string email
   * await mailService.sendTemplate('welcome', 'user@example.com', {
   *   userName: 'John',
   *   appName: 'Facets',
   *   loginUrl: 'https://app.facets.com/login',
   * });
   *
   * // Multiple recipients
   * await mailService.sendTemplate(
   *   'welcome',
   *   [
   *     { email: 'user1@example.com', name: 'User 1' },
   *     { email: 'user2@example.com', name: 'User 2' },
   *   ],
   *   { userName: 'Team', appName: 'Facets', loginUrl: '...' }
   * );
   */
  async sendTemplate<T extends TemplateName>(
    template: T,
    to: string | EmailRecipient | EmailRecipient[],
    variables: TemplateVariablesMap[T],
  ): Promise<void> {
    const recipient = typeof to === 'string' ? { email: to } : to;

    await this.mailProvider.sendTemplate({
      to: recipient,
      templateId: TEMPLATE_IDS[template],
      variables: variables as TemplateVariables,
    });
  }

  /**
   * Send a simple email without using a template
   *
   * Use this for one-off emails or when templates are not needed.
   * For most use cases, prefer `sendTemplate` for consistency.
   *
   * @param to - Recipient email(s)
   * @param subject - Email subject
   * @param content - Email content (text and/or HTML)
   *
   * @example
   * await mailService.send('admin@example.com', 'Alert!', {
   *   text: 'Something important happened',
   *   html: '<h1>Something important happened</h1>',
   * });
   */
  async send(
    to: string | EmailRecipient | EmailRecipient[],
    subject: string,
    content: { text?: string; html?: string },
  ): Promise<void> {
    const recipient = typeof to === 'string' ? { email: to } : to;

    await this.mailProvider.send({
      to: recipient,
      subject,
      ...content,
    });
  }
}
