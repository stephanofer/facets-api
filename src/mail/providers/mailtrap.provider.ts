import { Injectable, Logger } from '@nestjs/common';
import { MailtrapClient, TemplateVariables } from 'mailtrap';

import { ConfigService } from '@config/config.service';
import {
  MailProvider,
  SendEmailOptions,
  SendTemplateEmailOptions,
  TemplateVariables as MailTemplateVariables,
} from '@mail/providers/mail-provider.interface';

/**
 * Mailtrap implementation of the MailProvider interface
 *
 * Uses the official Mailtrap SDK to send emails via API.
 * Supports both sandbox (testing) and production modes.
 *
 * @see https://mailtrap.io/sending
 */
@Injectable()
export class MailtrapProvider implements MailProvider {
  private readonly client: MailtrapClient;
  private readonly logger = new Logger(MailtrapProvider.name);
  private readonly senderEmail: string;
  private readonly senderName: string;

  constructor(private readonly configService: ConfigService) {
    const mailConfig = this.configService.mail;

    this.client = new MailtrapClient({
      token: mailConfig.apiToken!,
      sandbox: mailConfig.sandbox,
      testInboxId: mailConfig.testInboxId,
    });

    this.senderEmail = mailConfig.senderEmail!;
    this.senderName = mailConfig.senderName;
  }

  /**
   * Send a simple email with plain text or HTML content
   */
  async send(options: SendEmailOptions): Promise<void> {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    this.logger.debug(
      `Sending email to ${recipients.map((r) => r.email).join(', ')}`,
    );

    await this.client.send({
      from: { email: this.senderEmail, name: this.senderName },
      to: recipients,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    this.logger.debug(
      `Email sent successfully to ${recipients.map((r) => r.email).join(', ')}`,
    );
  }

  /**
   * Send an email using a pre-defined Mailtrap template
   *
   * Templates are created in the Mailtrap dashboard and referenced by UUID.
   * @see https://mailtrap.io/sending/templates
   */
  async sendTemplate<T extends MailTemplateVariables>(
    options: SendTemplateEmailOptions<T>,
  ): Promise<void> {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    this.logger.debug(
      `Sending template [${options.templateId}] to ${recipients.map((r) => r.email).join(', ')}`,
    );

    await this.client.send({
      from: { email: this.senderEmail, name: this.senderName },
      to: recipients,
      template_uuid: options.templateId,
      template_variables: options.variables as TemplateVariables,
    });

    this.logger.debug(
      `Template [${options.templateId}] sent successfully to ${recipients.map((r) => r.email).join(', ')}`,
    );
  }
}
