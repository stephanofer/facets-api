import { Global, Module } from '@nestjs/common';
import { AiService } from '@ai/ai.service';
import { AiCapabilityRegistry } from '@ai/registry/ai-capability.registry';
import { AiResponseNormalizer } from '@ai/utils/ai-response-normalizer';
import { OpenAiGatewayClient } from '@ai/providers/openai-ai-gateway.client';
import { AI_GATEWAY_CLIENT } from '@ai/interfaces/ai-gateway-client.interface';
import { VoucherAnalyzerCapability } from '@ai/capabilities/voucher-analyzer.capability';

@Global()
@Module({
  providers: [
    {
      provide: AI_GATEWAY_CLIENT,
      useClass: OpenAiGatewayClient,
    },
    VoucherAnalyzerCapability,
    AiCapabilityRegistry,
    AiResponseNormalizer,
    AiService,
  ],
  exports: [AiService, AI_GATEWAY_CLIENT],
})
export class AiModule {}
