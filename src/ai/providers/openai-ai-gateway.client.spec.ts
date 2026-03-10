const createMock = jest.fn();

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: createMock,
      },
    },
  })),
}));

import OpenAI from 'openai';
import { OpenAiGatewayClient } from '@ai/providers/openai-ai-gateway.client';
import { ConfigService } from '@config/config.service';

describe('OpenAiGatewayClient', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it('should configure the OpenAI SDK for the AI Gateway compat endpoint and send bounded metadata', async () => {
    createMock.mockResolvedValue({ choices: [] });

    const configService = {
      ai: {
        apiToken: 'cf-token',
        baseUrl: 'https://gateway.ai.cloudflare.com/v1/account/gateway/compat',
        requestTimeoutMs: 30000,
      },
    } as ConfigService;

    const client = new OpenAiGatewayClient(configService);

    await client.executeChatCompletion({
      model: 'workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
      systemPrompt: 'system prompt',
      userContent: 'user prompt',
      metadata: {
        capability: 'voucher-analyzer',
        userId: 'user-1',
      },
      timeoutMs: 1000,
    });

    expect(OpenAI).toHaveBeenCalledWith({
      apiKey: 'cf-token',
      baseURL: 'https://gateway.ai.cloudflare.com/v1/account/gateway/compat',
      timeout: 30000,
    });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
      }),
      expect.objectContaining({
        headers: {
          'cf-aig-metadata': JSON.stringify({
            capability: 'voucher-analyzer',
            userId: 'user-1',
          }),
        },
        timeout: 1000,
      }),
    );
  });
});
