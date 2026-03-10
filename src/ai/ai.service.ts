import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AiCapabilityRegistry } from '@ai/registry/ai-capability.registry';
import {
  AiCapabilityDefinition,
  AiExecutionContext,
} from '@ai/interfaces/ai-capability.interface';
import {
  AI_GATEWAY_CLIENT,
  AiGatewayClient,
} from '@ai/interfaces/ai-gateway-client.interface';
import { AiExecutionResult } from '@ai/interfaces/ai-execution-result.interface';
import { AiResponseNormalizer } from '@ai/utils/ai-response-normalizer';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_CODES } from '@common/constants/app.constants';
import { Inject } from '@nestjs/common';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly capabilityRegistry: AiCapabilityRegistry,
    private readonly responseNormalizer: AiResponseNormalizer,
    @Inject(AI_GATEWAY_CLIENT)
    private readonly aiGatewayClient: AiGatewayClient,
  ) {}

  async execute<TInput, TParsed>(
    capabilityKey: string,
    input: TInput,
    context: AiExecutionContext,
  ): Promise<AiExecutionResult<TParsed>> {
    const capability = this.capabilityRegistry.get<TInput, TParsed>(
      capabilityKey,
    );

    if (!capability) {
      throw new BusinessException(
        ERROR_CODES.RESOURCE_NOT_FOUND,
        `AI capability '${capabilityKey}' not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    const metadata = this.limitMetadata(capability.buildMetadata(context));

    let rawResponse: unknown;

    try {
      rawResponse = await this.aiGatewayClient.executeChatCompletion({
        model: capability.model,
        systemPrompt: capability.systemPrompt,
        userContent: capability.buildUserContent(input),
        metadata,
        maxOutputTokens: capability.maxOutputTokens,
        timeoutMs: capability.timeoutMs,
      });
    } catch (error) {
      this.logger.error(
        `AI gateway execution failed for capability ${capability.key}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw new BusinessException(
        ERROR_CODES.AI_EXECUTION_FAILED,
        'AI execution failed',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const normalized = this.responseNormalizer.normalize(rawResponse, {
      capability: capability.key,
      model: capability.model,
      requestId: context.requestId,
    });

    try {
      const parsed = capability.parseNormalizedResult(normalized);
      return {
        ...normalized,
        parsed,
      };
    } catch (error) {
      this.logger.error(
        `AI response parsing failed for capability ${capability.key}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw new BusinessException(
        ERROR_CODES.AI_RESPONSE_INVALID,
        'AI response could not be parsed safely',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private limitMetadata(
    metadata: Record<string, string | number | boolean>,
  ): Record<string, string | number | boolean> {
    return Object.fromEntries(Object.entries(metadata).slice(0, 5));
  }
}
