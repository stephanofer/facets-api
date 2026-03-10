import { Injectable } from '@nestjs/common';
import { AiCapabilityDefinition } from '@ai/interfaces/ai-capability.interface';
import { VoucherAnalyzerCapability } from '@ai/capabilities/voucher-analyzer.capability';

@Injectable()
export class AiCapabilityRegistry {
  private readonly capabilities = new Map<string, AiCapabilityDefinition>();

  constructor(voucherAnalyzerCapability: VoucherAnalyzerCapability) {
    this.register(voucherAnalyzerCapability);
  }

  get<TInput = unknown, TParsed = unknown>(
    key: string,
  ): AiCapabilityDefinition<TInput, TParsed> | undefined {
    return this.capabilities.get(key) as
      | AiCapabilityDefinition<TInput, TParsed>
      | undefined;
  }

  private register(capability: AiCapabilityDefinition): void {
    this.capabilities.set(capability.key, capability);
  }
}
