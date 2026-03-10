import { AiExecutionResult } from '@ai/interfaces/ai-execution-result.interface';

export interface AiExecutionContext {
  capability: string;
  userId: string;
  module: string;
  requestId?: string;
  environment: string;
}

export interface AiCapabilityDefinition<TInput = unknown, TParsed = unknown> {
  key: string;
  model: string;
  systemPrompt: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
  buildUserContent(input: TInput): unknown;
  parseNormalizedResult(result: AiExecutionResult): TParsed;
  buildMetadata(
    context: AiExecutionContext,
  ): Record<string, string | number | boolean>;
}
