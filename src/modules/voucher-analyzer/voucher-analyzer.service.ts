import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { AiService } from '@ai/ai.service';
import { ERROR_CODES } from '@common/constants/app.constants';
import { BusinessException } from '@common/exceptions/business.exception';
import { ConfigService } from '@config/config.service';
import { VoucherAnalyzerCapabilityOutput } from '@ai/capabilities/voucher-analyzer.capability';
import {
  detectAndValidateUploadMimeType,
  TRANSIENT_UPLOAD_PURPOSES,
} from '@storage/config/file-purpose.config';
import { VoucherAnalysisResponseDto } from '@modules/voucher-analyzer/dtos/voucher-analysis-response.dto';

@Injectable()
export class VoucherAnalyzerService {
  constructor(
    private readonly aiService: AiService,
    private readonly configService: ConfigService,
  ) {}

  async analyze(
    userId: string,
    file: Express.Multer.File,
    requestId?: string,
  ): Promise<VoucherAnalysisResponseDto> {
    const mimeType = this.resolveMimeType(file);
    const result = await this.aiService.execute<
      { mimeType: string; base64Image: string },
      VoucherAnalyzerCapabilityOutput
    >(
      'voucher-analyzer',
      {
        mimeType,
        base64Image: file.buffer.toString('base64'),
      },
      {
        capability: 'voucher-analyzer',
        userId,
        module: 'voucher-analyzer',
        requestId,
        environment: this.configService.ai.metadataEnvironment,
      },
    );

    const parsed = result.parsed;

    if (!parsed) {
      throw new BusinessException(
        ERROR_CODES.AI_RESPONSE_INVALID,
        'AI response could not be parsed safely',
      );
    }

    return {
      status: parsed.status,
      document: {
        type: parsed.status === 'VOUCHER' ? 'voucher' : 'unknown',
        ...(typeof parsed.confidence === 'number'
          ? { confidence: parsed.confidence }
          : {}),
      },
      extraction: {
        text:
          parsed.status === 'VOUCHER'
            ? this.resolveExtractionText(parsed.text)
            : null,
        fields:
          parsed.status === 'VOUCHER'
            ? {
                merchantName: parsed.fields?.merchantName ?? null,
                issuedAt: parsed.fields?.issuedAt ?? null,
                totalAmount: parsed.fields?.totalAmount ?? null,
                currency: parsed.fields?.currency ?? null,
                taxAmount: parsed.fields?.taxAmount ?? null,
                paymentMethod: parsed.fields?.paymentMethod ?? null,
              }
            : null,
      },
      diagnostics: {
        model: result.metadata.gatewayModel ?? result.metadata.model,
        warnings:
          parsed.status === 'NOT_VOUCHER'
            ? parsed.warnings.length > 0
              ? parsed.warnings
              : ['The uploaded image does not appear to be a voucher document.']
            : parsed.warnings,
      },
    };
  }

  private resolveExtractionText(
    text: string | null | undefined,
  ): string | null {
    if (typeof text !== 'string') {
      return null;
    }

    const normalizedText = text.trim();
    return normalizedText.length > 0 ? normalizedText : null;
  }

  private resolveMimeType(file: Express.Multer.File): string {
    try {
      return detectAndValidateUploadMimeType(
        TRANSIENT_UPLOAD_PURPOSES.VOUCHER_ANALYSIS,
        file.buffer,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid file';
      throw new UnprocessableEntityException(message);
    }
  }
}
