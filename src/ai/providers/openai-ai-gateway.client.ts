import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import {
  AiGatewayChatCompletionRequest,
  AiGatewayClient,
} from '@ai/interfaces/ai-gateway-client.interface';
import { ConfigService } from '@config/config.service';

@Injectable()
export class OpenAiGatewayClient implements AiGatewayClient {
  private readonly client: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.configService.ai.apiToken,
      baseURL: this.configService.ai.baseUrl,
      timeout: this.configService.ai.requestTimeoutMs,
    });
  }

  async executeChatCompletion(
    request: AiGatewayChatCompletionRequest,
  ): Promise<unknown> {
    return this.client.chat.completions.create(
      {
        model: request.model,
        messages: [
          {
            role: 'system',
            content: request.systemPrompt,
          },
          {
            role: 'user',
            content:
              request.userContent as OpenAI.Chat.Completions.ChatCompletionUserMessageParam['content'],
          },
        ],
        max_tokens: request.maxOutputTokens,
      },
      {
        headers: request.metadata
          ? {
              'cf-aig-metadata': JSON.stringify(request.metadata),
            }
          : undefined,
        timeout: request.timeoutMs,
      },
    );
  }
}
