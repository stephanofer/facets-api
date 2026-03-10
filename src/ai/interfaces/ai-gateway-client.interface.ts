export const AI_GATEWAY_CLIENT = Symbol('AI_GATEWAY_CLIENT');

export interface AiGatewayChatCompletionRequest {
  model: string;
  systemPrompt: string;
  userContent: unknown;
  metadata?: Record<string, string | number | boolean>;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

export interface AiGatewayClient {
  executeChatCompletion(
    request: AiGatewayChatCompletionRequest,
  ): Promise<unknown>;
}
