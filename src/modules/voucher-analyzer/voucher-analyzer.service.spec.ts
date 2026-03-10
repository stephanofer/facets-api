import { Test, TestingModule } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';
import { VoucherAnalyzerService } from '@modules/voucher-analyzer/voucher-analyzer.service';
import { AiService } from '@ai/ai.service';
import { ConfigService } from '@config/config.service';

describe('VoucherAnalyzerService', () => {
  let service: VoucherAnalyzerService;
  let aiService: jest.Mocked<AiService>;

  const configService = {
    ai: {
      metadataEnvironment: 'test',
    },
  } as ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoucherAnalyzerService,
        {
          provide: AiService,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get(VoucherAnalyzerService);
    aiService = module.get(AiService);
  });

  it('should map a voucher response into the stable public contract', async () => {
    aiService.execute.mockResolvedValue({
      raw: {},
      text: 'Supermercado X',
      json: null,
      parsed: {
        status: 'VOUCHER',
        confidence: 0.91,
        text: 'Supermercado X',
        warnings: [],
        fields: {
          merchantName: 'Supermercado X',
          issuedAt: '2026-03-09',
          totalAmount: '123.45',
          currency: 'ARS',
          taxAmount: null,
          paymentMethod: null,
        },
      },
      metadata: {
        capability: 'voucher-analyzer',
        model: 'workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
      },
    });

    const result = await service.analyze('user-1', {
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]),
    } as Express.Multer.File);

    expect(result).toEqual({
      status: 'VOUCHER',
      document: {
        type: 'voucher',
        confidence: 0.91,
      },
      extraction: {
        text: 'Supermercado X',
        fields: {
          merchantName: 'Supermercado X',
          issuedAt: '2026-03-09',
          totalAmount: '123.45',
          currency: 'ARS',
          taxAmount: null,
          paymentMethod: null,
        },
      },
      diagnostics: {
        model: 'workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
        warnings: [],
      },
    });
  });

  it('should treat NOT_VOUCHER as a successful business outcome', async () => {
    aiService.execute.mockResolvedValue({
      raw: {},
      text: null,
      json: null,
      parsed: {
        status: 'NOT_VOUCHER',
        confidence: 0.88,
        text: null,
        warnings: [],
        fields: null,
      },
      metadata: {
        capability: 'voucher-analyzer',
        model: 'workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
      },
    });

    const result = await service.analyze('user-1', {
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb]),
    } as Express.Multer.File);

    expect(result.status).toBe('NOT_VOUCHER');
    expect(result.extraction.fields).toBeNull();
    expect(result.diagnostics.warnings).toEqual([
      'The uploaded image does not appear to be a voucher document.',
    ]);
  });

  it('should reject disguised files before AI execution', async () => {
    await expect(
      service.analyze('user-1', {
        buffer: Buffer.from('%PDF-1.7'),
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(aiService.execute).not.toHaveBeenCalled();
  });

  it('should preserve conservative partial output for partially legible vouchers', async () => {
    aiService.execute.mockResolvedValue({
      raw: {},
      text: 'MERCHANT\nTOTAL 123.45',
      json: null,
      parsed: {
        status: 'VOUCHER',
        confidence: 0.64,
        text: 'MERCHANT\nTOTAL 123.45',
        warnings: ['Issued date could not be determined.'],
        fields: {
          merchantName: 'MERCHANT',
          issuedAt: null,
          totalAmount: '123.45',
          currency: null,
          taxAmount: null,
          paymentMethod: null,
        },
      },
      metadata: {
        capability: 'voucher-analyzer',
        model: 'workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
      },
    });

    const result = await service.analyze('user-1', {
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]),
    } as Express.Multer.File);

    expect(result).toMatchObject({
      status: 'VOUCHER',
      document: {
        type: 'voucher',
        confidence: 0.64,
      },
      extraction: {
        text: 'MERCHANT\nTOTAL 123.45',
        fields: {
          merchantName: 'MERCHANT',
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

  it('should accept structured normalized json from shared AI infrastructure', async () => {
    const parsedPayload = {
      status: 'VOUCHER' as const,
      confidence: 0.93,
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
    };

    aiService.execute.mockResolvedValue({
      raw: {
        choices: [
          {
            message: {
              content: parsedPayload,
            },
          },
        ],
      },
      text: JSON.stringify(parsedPayload),
      json: parsedPayload,
      parsed: parsedPayload,
      metadata: {
        capability: 'voucher-analyzer',
        model: 'workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
      },
    });

    const result = await service.analyze('user-1', {
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]),
    } as Express.Multer.File);

    expect(result).toEqual({
      status: 'VOUCHER',
      document: {
        type: 'voucher',
        confidence: 0.93,
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

  it('should not leak serialized structured payloads into extraction text', async () => {
    const parsedPayload = {
      status: 'VOUCHER' as const,
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
    };

    aiService.execute.mockResolvedValue({
      raw: {
        choices: [
          {
            message: {
              content: parsedPayload,
            },
          },
        ],
      },
      text: JSON.stringify(parsedPayload),
      json: parsedPayload,
      parsed: parsedPayload,
      metadata: {
        capability: 'voucher-analyzer',
        model: 'workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
      },
    });

    const result = await service.analyze('user-1', {
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb]),
    } as Express.Multer.File);

    expect(result.extraction).toEqual({
      text: null,
      fields: {
        merchantName: 'BCP',
        issuedAt: '2026-03-08T12:15:00',
        totalAmount: '30.00',
        currency: 'PEN',
        taxAmount: null,
        paymentMethod: 'YAPE',
      },
    });
  });
});
