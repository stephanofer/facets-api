import { Global, Module } from '@nestjs/common';

import { MAIL_PROVIDER } from '@mail/providers/mail-provider.interface';
import { MailtrapProvider } from '@mail/providers/mailtrap.provider';
import { MailService } from '@mail/mail.service';

/**
 * Global mail module for sending emails
 *
 * This module is marked as @Global, so MailService is available
 * throughout the application without needing to import MailModule.
 *
 * The module uses dependency injection to allow easy switching
 * between email providers (Mailtrap, SendGrid, Resend, etc.)
 *
 * To switch providers, change the `useClass` in the MAIL_PROVIDER:
 *
 * @example
 * // Switch to SendGrid
 * {
 *   provide: MAIL_PROVIDER,
 *   useClass: SendGridProvider,
 * }
 */
@Global()
@Module({
  providers: [
    {
      provide: MAIL_PROVIDER,
      useClass: MailtrapProvider,
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
