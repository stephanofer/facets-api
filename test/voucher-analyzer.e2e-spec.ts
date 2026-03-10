import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  createTestApp,
  createTestUser,
  cleanupTestUser,
  getAiGatewayClientMock,
} from './helpers/test-app.helper';

describe('Voucher analyzer (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let userId: string;

  const aiGatewayClientMock = getAiGatewayClientMock();
  const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  beforeAll(async () => {
    app = await createTestApp();
    const testUser = await createTestUser(app);
    accessToken = testUser.accessToken;
    userId = testUser.userId;
  }, 30000);

  beforeEach(() => {
    aiGatewayClientMock.executeChatCompletion.mockReset();
  });

  afterAll(async () => {
    await cleanupTestUser(app, userId);
    await app.close();
  });

  describe('POST /api/voucher-analyzer', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .post('/api/voucher-analyzer')
        .attach('file', pngBuffer, {
          filename: 'voucher.png',
          contentType: 'image/png',
        })
        .expect(401);
    });

    it('should reject invalid mime type before AI execution', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/voucher-analyzer')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from('not-an-image'), {
          filename: 'voucher.txt',
          contentType: 'text/plain',
        })
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(aiGatewayClientMock.executeChatCompletion).not.toHaveBeenCalled();
    });

    it('should reject disguised files before AI execution', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/voucher-analyzer')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from('%PDF-1.7'), {
          filename: 'voucher.png',
          contentType: 'image/png',
        })
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(aiGatewayClientMock.executeChatCompletion).not.toHaveBeenCalled();
    });

    it('should return structured voucher data when the image is a voucher', async () => {
      aiGatewayClientMock.executeChatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                status: 'VOUCHER',
                confidence: 0.94,
                text: 'Supermercado X TOTAL 123.45',
                warnings: [],
                fields: {
                  merchantName: 'Supermercado X',
                  issuedAt: '2026-03-09',
                  totalAmount: '123.45',
                  currency: 'ARS',
                  taxAmount: null,
                  paymentMethod: 'debit_card',
                },
              }),
            },
          },
        ],
      });

      const res = await request(app.getHttpServer())
        .post('/api/voucher-analyzer')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', pngBuffer, {
          filename: 'voucher.png',
          contentType: 'image/png',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        status: 'VOUCHER',
        document: {
          type: 'voucher',
          confidence: 0.94,
        },
        extraction: {
          text: 'Supermercado X TOTAL 123.45',
          fields: {
            merchantName: 'Supermercado X',
            issuedAt: '2026-03-09',
            totalAmount: '123.45',
            currency: 'ARS',
            taxAmount: null,
            paymentMethod: 'debit_card',
          },
        },
        diagnostics: {
          model: 'workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
          warnings: [],
        },
      });
    });

    it('should accept OpenAI-compatible object message content from the gateway', async () => {
      aiGatewayClientMock.executeChatCompletion.mockResolvedValue({
        id: 'chatcmpl-cf-object-content',
        object: 'chat.completion',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: {
                status: 'VOUCHER',
                confidence: 0.92,
                text: null,
                warnings: [],
                fields: {
                  merchantName: 'Farmacia Central',
                  issuedAt: '2026-03-09',
                  totalAmount: '4520.00',
                  currency: 'ARS',
                  taxAmount: null,
                  paymentMethod: 'credit_card',
                },
              },
            },
          },
        ],
      });

      const res = await request(app.getHttpServer())
        .post('/api/voucher-analyzer')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', pngBuffer, {
          filename: 'voucher-object-content.png',
          contentType: 'image/png',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        status: 'VOUCHER',
        document: {
          type: 'voucher',
          confidence: 0.92,
        },
        extraction: {
          text: null,
          fields: {
            merchantName: 'Farmacia Central',
            issuedAt: '2026-03-09',
            totalAmount: '4520.00',
            currency: 'ARS',
            taxAmount: null,
            paymentMethod: 'credit_card',
          },
        },
        diagnostics: {
          model: 'workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
          warnings: [],
        },
      });
    });

    it('should keep extraction text null when the gateway returns structured fields without human-readable text', async () => {
      aiGatewayClientMock.executeChatCompletion.mockResolvedValue({
        id: 'chatcmpl-cf-object-content-no-text',
        object: 'chat.completion',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: {
                status: 'VOUCHER',
                confidence: 0.9,
                text: null,
                warnings: [],
                fields: {
                  merchantName: 'BCP',
                  issuedAt: '2026-03-08T12:15:00',
                  totalAmount: '30.00',
                  currency: 'PEN',
                  taxAmount: null,
                  paymentMethod: 'YAPE',
                },
              },
            },
          },
        ],
      });

      const res = await request(app.getHttpServer())
        .post('/api/voucher-analyzer')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', pngBuffer, {
          filename: 'voucher-structured-no-text.png',
          contentType: 'image/png',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        status: 'VOUCHER',
        document: {
          type: 'voucher',
          confidence: 0.9,
        },
        extraction: {
          text: null,
          fields: {
            merchantName: 'BCP',
            issuedAt: '2026-03-08T12:15:00',
            totalAmount: '30.00',
            currency: 'PEN',
            taxAmount: null,
            paymentMethod: 'YAPE',
          },
        },
        diagnostics: {
          model: 'workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
          warnings: [],
        },
      });
    });

    it('should treat NOT_VOUCHER as a successful business outcome', async () => {
      aiGatewayClientMock.executeChatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                status: 'NOT_VOUCHER',
                confidence: 0.81,
                text: null,
                warnings: [
                  'The uploaded image does not appear to be a voucher document.',
                ],
                fields: null,
              }),
            },
          },
        ],
      });

      const res = await request(app.getHttpServer())
        .post('/api/voucher-analyzer')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', pngBuffer, {
          filename: 'not-voucher.png',
          contentType: 'image/png',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        status: 'NOT_VOUCHER',
        document: {
          type: 'unknown',
          confidence: 0.81,
        },
        extraction: {
          text: null,
          fields: null,
        },
      });
    });

    it('should return the standard error envelope when AI execution fails', async () => {
      aiGatewayClientMock.executeChatCompletion.mockRejectedValue(
        new Error('gateway down'),
      );

      const res = await request(app.getHttpServer())
        .post('/api/voucher-analyzer')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', pngBuffer, {
          filename: 'voucher.png',
          contentType: 'image/png',
        })
        .expect(502);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AI_EXECUTION_FAILED');
      expect(res.body.error.message).toBe('AI execution failed');
    });

    it('should reject oversized voucher images before AI execution', async () => {
      const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1, 0);
      oversizedBuffer[0] = 0x89;
      oversizedBuffer[1] = 0x50;
      oversizedBuffer[2] = 0x4e;
      oversizedBuffer[3] = 0x47;

      const res = await request(app.getHttpServer())
        .post('/api/voucher-analyzer')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', oversizedBuffer, {
          filename: 'oversized.png',
          contentType: 'image/png',
        })
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(aiGatewayClientMock.executeChatCompletion).not.toHaveBeenCalled();
    });

    it('should return conservative partial output for partially legible vouchers', async () => {
      aiGatewayClientMock.executeChatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                status: 'VOUCHER',
                confidence: 0.67,
                text: 'SUPERMERCADO X\nTOTAL 123.45',
                warnings: ['Issued date could not be determined.'],
                fields: {
                  merchantName: 'SUPERMERCADO X',
                  issuedAt: null,
                  totalAmount: '123.45',
                  currency: null,
                  taxAmount: null,
                  paymentMethod: null,
                },
              }),
            },
          },
        ],
      });

      const res = await request(app.getHttpServer())
        .post('/api/voucher-analyzer')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', pngBuffer, {
          filename: 'partial-voucher.png',
          contentType: 'image/png',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        status: 'VOUCHER',
        extraction: {
          text: 'SUPERMERCADO X\nTOTAL 123.45',
          fields: {
            merchantName: 'SUPERMERCADO X',
            issuedAt: null,
            totalAmount: '123.45',
            currency: null,
            taxAmount: null,
            paymentMethod: null,
          },
        },
        diagnostics: {
          warnings: ['Issued date could not be determined.'],
        },
      });
    });
  });
});
