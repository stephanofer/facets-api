import { AiResponseNormalizer } from '@ai/utils/ai-response-normalizer';

describe('AiResponseNormalizer', () => {
  const normalizer = new AiResponseNormalizer();
  const metadata = {
    capability: 'voucher-analyzer',
    model: 'workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
  };

  it('should preserve plain text responses', () => {
    const result = normalizer.normalize('plain text response', metadata);

    expect(result.text).toBe('plain text response');
    expect(result.json).toBeNull();
  });

  it('should parse JSON string responses', () => {
    const result = normalizer.normalize(
      '{"status":"NOT_VOUCHER","warnings":[]}',
      metadata,
    );

    expect(result.text).toBe('{"status":"NOT_VOUCHER","warnings":[]}');
    expect(result.json).toEqual({ status: 'NOT_VOUCHER', warnings: [] });
  });

  it('should extract content from chat completion responses', () => {
    const result = normalizer.normalize(
      {
        choices: [
          {
            message: {
              content:
                '{"status":"VOUCHER","confidence":0.9,"fields":null,"warnings":[]}',
            },
          },
        ],
      },
      metadata,
    );

    expect(result.text).toContain('"status":"VOUCHER"');
    expect(result.json).toEqual({
      status: 'VOUCHER',
      confidence: 0.9,
      fields: null,
      warnings: [],
    });
  });

  it('should concatenate mixed content arrays', () => {
    const result = normalizer.normalize(
      {
        content: [
          { text: 'first line' },
          'second line',
          { content: '{"status":"NOT_VOUCHER","warnings":["x"]}' },
        ],
      },
      metadata,
    );

    expect(result.text).toBe(
      'first line\nsecond line\n{"status":"NOT_VOUCHER","warnings":["x"]}',
    );
    expect(result.json).toEqual({ status: 'NOT_VOUCHER', warnings: ['x'] });
  });

  it('should preserve object chat completion content as structured JSON', () => {
    const payload = {
      status: 'VOUCHER',
      confidence: 0.97,
      text: 'Farmacia Central TOTAL 4520.00',
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

    const result = normalizer.normalize(
      {
        id: 'chatcmpl-real-shape',
        object: 'chat.completion',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: payload,
            },
          },
        ],
      },
      metadata,
    );

    expect(result.text).toBe(JSON.stringify(payload));
    expect(result.json).toEqual(payload);
  });
});
