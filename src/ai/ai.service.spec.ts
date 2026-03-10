import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { AiService } from '@ai/ai.service';
import { AiCapabilityRegistry } from '@ai/registry/ai-capability.registry';
import { AiResponseNormalizer } from '@ai/utils/ai-response-normalizer';
import {
  AI_GATEWAY_CLIENT,
  AiGatewayClient,
} from '@ai/interfaces/ai-gateway-client.interface';

describe('AiService', () => {
  let service: AiService;
  let registry: jest.Mocked<AiCapabilityRegistry>;
  let normalizer: jest.Mocked<AiResponseNormalizer>;
  let client: jest.Mocked<AiGatewayClient>;

  const capability = {
    key: 'voucher-analyzer',
    model: 'workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
    systemPrompt: 'return JSON',
    buildUserContent: jest.fn().mockReturnValue('payload'),
    parseNormalizedResult: jest.fn().mockReturnValue({ status: 'NOT_VOUCHER' }),
    buildMetadata: jest.fn().mockReturnValue({
      capability: 'voucher-analyzer',
      userId: 'user-1',
      module: 'voucher-analyzer',
      environment: 'test',
      requestId: 'req-1',
      extra: 'ignored',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: AiCapabilityRegistry,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: AiResponseNormalizer,
          useValue: {
            normalize: jest.fn(),
          },
        },
        {
          provide: AI_GATEWAY_CLIENT,
          useValue: {
            executeChatCompletion: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AiService);
    registry = module.get(AiCapabilityRegistry);
    normalizer = module.get(AiResponseNormalizer);
    client = module.get(AI_GATEWAY_CLIENT);
  });

  it('should execute a registered capability and limit metadata to five keys', async () => {
    registry.get.mockReturnValue(capability as never);
    client.executeChatCompletion.mockResolvedValue({ choices: [] });
    normalizer.normalize.mockReturnValue({
      raw: { choices: [] },
      text: '{"status":"NOT_VOUCHER"}',
      json: { status: 'NOT_VOUCHER' },
      parsed: null,
      metadata: {
        capability: capability.key,
        model: capability.model,
      },
    });

    const result = await service.execute(
      'voucher-analyzer',
      { foo: 'bar' },
      {
        capability: 'voucher-analyzer',
        userId: 'user-1',
        module: 'voucher-analyzer',
        requestId: 'req-1',
        environment: 'test',
      },
    );

    expect(client.executeChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          capability: 'voucher-analyzer',
          userId: 'user-1',
          module: 'voucher-analyzer',
          environment: 'test',
          requestId: 'req-1',
        },
      }),
    );
    expect(result.parsed).toEqual({ status: 'NOT_VOUCHER' });
  });

  it('should pass through dynamic route models without changing the caller contract', async () => {
    registry.get.mockReturnValue({
      ...capability,
      model: 'dynamic/ocr-vouchers',
    } as never);
    client.executeChatCompletion.mockResolvedValue({ choices: [] });
    normalizer.normalize.mockReturnValue({
      raw: { choices: [] },
      text: '{"status":"NOT_VOUCHER"}',
      json: { status: 'NOT_VOUCHER' },
      parsed: null,
      metadata: {
        capability: capability.key,
        model: 'dynamic/ocr-vouchers',
      },
    });

    await service.execute(
      'voucher-analyzer',
      { foo: 'bar' },
      {
        capability: 'voucher-analyzer',
        userId: 'user-1',
        module: 'voucher-analyzer',
        requestId: 'req-1',
        environment: 'test',
      },
    );

    expect(client.executeChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'dynamic/ocr-vouchers',
      }),
    );
  });

  it('should fail when capability is unknown', async () => {
    registry.get.mockReturnValue(undefined);

    await expect(
      service.execute(
        'unknown',
        {},
        {
          capability: 'unknown',
          userId: 'user-1',
          module: 'voucher-analyzer',
          environment: 'test',
        },
      ),
    ).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('should wrap gateway execution failures', async () => {
    registry.get.mockReturnValue(capability as never);
    client.executeChatCompletion.mockRejectedValue(new Error('boom'));

    await expect(
      service.execute(
        'voucher-analyzer',
        {},
        {
          capability: 'voucher-analyzer',
          userId: 'user-1',
          module: 'voucher-analyzer',
          environment: 'test',
        },
      ),
    ).rejects.toMatchObject({
      code: 'AI_EXECUTION_FAILED',
      status: HttpStatus.BAD_GATEWAY,
    });
  });

  it('should wrap parsing failures safely', async () => {
    registry.get.mockReturnValue({
      ...capability,
      parseNormalizedResult: jest.fn(() => {
        throw new Error('bad payload');
      }),
    } as never);
    client.executeChatCompletion.mockResolvedValue({ choices: [] });
    normalizer.normalize.mockReturnValue({
      raw: { choices: [] },
      text: 'not json',
      json: null,
      parsed: null,
      metadata: {
        capability: capability.key,
        model: capability.model,
      },
    });

    await expect(
      service.execute(
        'voucher-analyzer',
        {},
        {
          capability: 'voucher-analyzer',
          userId: 'user-1',
          module: 'voucher-analyzer',
          environment: 'test',
        },
      ),
    ).rejects.toMatchObject({
      code: 'AI_RESPONSE_INVALID',
      status: HttpStatus.BAD_GATEWAY,
    });
  });
});
