import { Injectable } from '@nestjs/common';
import {
  AiCapabilityDefinition,
  AiExecutionContext,
} from '@ai/interfaces/ai-capability.interface';
import { AiExecutionResult } from '@ai/interfaces/ai-execution-result.interface';
import { z } from 'zod';

const voucherAnalysisSchema = z.object({
  status: z.enum(['VOUCHER', 'NOT_VOUCHER']),
  confidence: z.number().min(0).max(1).optional().nullable(),
  text: z.string().nullable().optional(),
  warnings: z.array(z.string()).optional().default([]),
  fields: z
    .object({
      merchantName: z.string().nullable().optional(),
      issuedAt: z.string().nullable().optional(),
      totalAmount: z.string().nullable().optional(),
      currency: z.string().nullable().optional(),
      taxAmount: z.string().nullable().optional(),
      paymentMethod: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export type VoucherAnalyzerCapabilityOutput = z.infer<
  typeof voucherAnalysisSchema
>;

export interface VoucherAnalyzerCapabilityInput {
  mimeType: string;
  base64Image: string;
}

@Injectable()
export class VoucherAnalyzerCapability implements AiCapabilityDefinition<
  VoucherAnalyzerCapabilityInput,
  VoucherAnalyzerCapabilityOutput
> {
  readonly key = 'voucher-analyzer';
  readonly model = 'workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct';
  readonly timeoutMs = 30_000;
  readonly maxOutputTokens = 800;
  readonly systemPrompt = `You analyze uploaded images and must respond with JSON only. Determine whether the image is a voucher/receipt document. If it is a voucher, extract structured fields conservatively. If it is not a voucher, return status NOT_VOUCHER. Never invent values. Use this JSON schema exactly: {"status":"VOUCHER"|"NOT_VOUCHER","confidence":number|null,"text":string|null,"warnings":string[],"fields":{"merchantName":string|null,"issuedAt":string|null,"totalAmount":string|null,"currency":string|null,"taxAmount":string|null,"paymentMethod":string|null}|null}`;

  buildUserContent(input: VoucherAnalyzerCapabilityInput): unknown {
    return [
      {
        type: 'text',
        text: 'Analyze this image and return only the required JSON payload.',
      },
      {
        type: 'image_url',
        image_url: {
          url: `data:${input.mimeType};base64,${input.base64Image}`,
        },
      },
    ];
  }

  parseNormalizedResult(
    result: AiExecutionResult,
  ): VoucherAnalyzerCapabilityOutput {
    const candidate = result.json ?? this.extractJsonFromText(result.text);
    return voucherAnalysisSchema.parse(candidate);
  }

  buildMetadata(
    context: AiExecutionContext,
  ): Record<string, string | number | boolean> {
    return {
      capability: context.capability,
      userId: context.userId,
      module: context.module,
      environment: context.environment,
      requestId: context.requestId ?? 'unknown',
    };
  }

  private extractJsonFromText(
    text: string | null,
  ): Record<string, unknown> | Array<unknown> | null {
    if (!text) {
      return null;
    }

    const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fencedMatch?.[1]?.trim() ?? text.trim();
    return JSON.parse(candidate) as Record<string, unknown> | Array<unknown>;
  }
}
