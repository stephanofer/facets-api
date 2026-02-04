import { Test, TestingModule } from '@nestjs/testing';

import { MailService } from '@mail/mail.service';
import {
  MAIL_PROVIDER,
  MailProvider,
} from '@mail/providers/mail-provider.interface';
import { TEMPLATE_IDS } from '@mail/templates/template.registry';

describe('MailService', () => {
  let service: MailService;
  let mockProvider: jest.Mocked<MailProvider>;

  beforeEach(async () => {
    mockProvider = {
      send: jest.fn().mockResolvedValue(undefined),
      sendTemplate: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: MAIL_PROVIDER,
          useValue: mockProvider,
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendTemplate', () => {
    it('should send welcome email with correct template ID and variables', async () => {
      const variables = {
        userName: 'John Doe',
        appName: 'Facets',
        loginUrl: 'https://app.facets.com/login',
      };

      await service.sendTemplate('welcome', 'user@example.com', variables);

      expect(mockProvider.sendTemplate).toHaveBeenCalledTimes(1);
      expect(mockProvider.sendTemplate).toHaveBeenCalledWith({
        to: { email: 'user@example.com' },
        templateId: TEMPLATE_IDS.welcome,
        variables,
      });
    });

    it('should send password-reset email with correct template ID', async () => {
      const variables = {
        userName: 'Jane Doe',
        otpCode: '123456',
        expiresInMinutes: 10,
      };

      await service.sendTemplate(
        'password-reset',
        'user@example.com',
        variables,
      );

      expect(mockProvider.sendTemplate).toHaveBeenCalledWith({
        to: { email: 'user@example.com' },
        templateId: TEMPLATE_IDS['password-reset'],
        variables,
      });
    });

    it('should send email-verification with correct template ID', async () => {
      const variables = {
        userName: 'User',
        otpCode: '654321',
        expiresInMinutes: 10,
      };

      await service.sendTemplate(
        'email-verification',
        'user@example.com',
        variables,
      );

      expect(mockProvider.sendTemplate).toHaveBeenCalledWith({
        to: { email: 'user@example.com' },
        templateId: TEMPLATE_IDS['email-verification'],
        variables,
      });
    });

    it('should accept EmailRecipient object', async () => {
      const recipient = { email: 'user@example.com', name: 'John Doe' };
      const variables = {
        userName: 'John',
        appName: 'Facets',
        loginUrl: 'https://app.facets.com',
      };

      await service.sendTemplate('welcome', recipient, variables);

      expect(mockProvider.sendTemplate).toHaveBeenCalledWith({
        to: recipient,
        templateId: TEMPLATE_IDS.welcome,
        variables,
      });
    });

    it('should accept array of recipients', async () => {
      const recipients = [
        { email: 'user1@example.com', name: 'User 1' },
        { email: 'user2@example.com', name: 'User 2' },
      ];
      const variables = {
        userName: 'Team',
        appName: 'Facets',
        loginUrl: 'https://app.facets.com',
      };

      await service.sendTemplate('welcome', recipients, variables);

      expect(mockProvider.sendTemplate).toHaveBeenCalledWith({
        to: recipients,
        templateId: TEMPLATE_IDS.welcome,
        variables,
      });
    });
  });

  describe('send', () => {
    it('should send simple email with text content', async () => {
      await service.send('admin@example.com', 'Test Subject', {
        text: 'This is a test email',
      });

      expect(mockProvider.send).toHaveBeenCalledTimes(1);
      expect(mockProvider.send).toHaveBeenCalledWith({
        to: { email: 'admin@example.com' },
        subject: 'Test Subject',
        text: 'This is a test email',
      });
    });

    it('should send simple email with HTML content', async () => {
      await service.send('admin@example.com', 'HTML Test', {
        html: '<h1>Hello World</h1>',
      });

      expect(mockProvider.send).toHaveBeenCalledWith({
        to: { email: 'admin@example.com' },
        subject: 'HTML Test',
        html: '<h1>Hello World</h1>',
      });
    });

    it('should send email with both text and HTML content', async () => {
      await service.send('admin@example.com', 'Multi-format', {
        text: 'Plain text version',
        html: '<p>HTML version</p>',
      });

      expect(mockProvider.send).toHaveBeenCalledWith({
        to: { email: 'admin@example.com' },
        subject: 'Multi-format',
        text: 'Plain text version',
        html: '<p>HTML version</p>',
      });
    });

    it('should accept EmailRecipient object for simple email', async () => {
      const recipient = { email: 'user@example.com', name: 'User' };

      await service.send(recipient, 'Subject', { text: 'Content' });

      expect(mockProvider.send).toHaveBeenCalledWith({
        to: recipient,
        subject: 'Subject',
        text: 'Content',
      });
    });

    it('should accept array of recipients for simple email', async () => {
      const recipients = [
        { email: 'user1@example.com' },
        { email: 'user2@example.com' },
      ];

      await service.send(recipients, 'Broadcast', { text: 'Message' });

      expect(mockProvider.send).toHaveBeenCalledWith({
        to: recipients,
        subject: 'Broadcast',
        text: 'Message',
      });
    });
  });

  describe('error handling', () => {
    it('should propagate errors from provider on sendTemplate', async () => {
      const error = new Error('Mailtrap API error');
      mockProvider.sendTemplate.mockRejectedValueOnce(error);

      await expect(
        service.sendTemplate('welcome', 'user@example.com', {
          userName: 'John',
          appName: 'Facets',
          loginUrl: 'https://app.facets.com',
        }),
      ).rejects.toThrow('Mailtrap API error');
    });

    it('should propagate errors from provider on send', async () => {
      const error = new Error('Send failed');
      mockProvider.send.mockRejectedValueOnce(error);

      await expect(
        service.send('admin@example.com', 'Test', { text: 'Content' }),
      ).rejects.toThrow('Send failed');
    });
  });
});
