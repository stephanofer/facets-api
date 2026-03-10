import { Injectable } from '@nestjs/common';
import {
  AiExecutionMetadata,
  AiExecutionResult,
} from '@ai/interfaces/ai-execution-result.interface';

@Injectable()
export class AiResponseNormalizer {
  normalize(
    raw: unknown,
    metadata: AiExecutionMetadata,
  ): AiExecutionResult<unknown> {
    const content = this.extractContent(raw);
    const text = this.extractText(raw, content);
    const json = this.extractJson(raw, text, content);

    return {
      raw,
      text,
      json,
      parsed: null,
      metadata,
    };
  }

  private extractContent(
    raw: unknown,
  ): Record<string, unknown> | Array<unknown> | null {
    if (!this.isRecord(raw)) {
      return null;
    }

    const directContent = this.readStructuredContentFromObject(raw);
    if (directContent) {
      return directContent;
    }

    if (Array.isArray(raw.choices)) {
      const firstChoice = raw.choices[0];
      if (this.isRecord(firstChoice) && this.isRecord(firstChoice.message)) {
        return this.readStructuredValue(firstChoice.message.content);
      }
    }

    return null;
  }

  private extractText(
    raw: unknown,
    extractedContent: Record<string, unknown> | Array<unknown> | null,
  ): string | null {
    if (typeof raw === 'string') {
      return raw;
    }

    if (extractedContent) {
      return JSON.stringify(extractedContent);
    }

    if (this.isRecord(raw)) {
      const directText = this.readTextFromObject(raw);
      if (directText) {
        return directText;
      }
    }

    return null;
  }

  private readStructuredContentFromObject(
    value: Record<string, unknown>,
  ): Record<string, unknown> | Array<unknown> | null {
    if (this.isRecord(value.content)) {
      return value.content;
    }

    return null;
  }

  private readStructuredValue(
    value: unknown,
  ): Record<string, unknown> | Array<unknown> | null {
    if (this.isRecord(value)) {
      return value;
    }

    return null;
  }

  private readTextFromObject(value: Record<string, unknown>): string | null {
    if (typeof value.content === 'string') {
      return value.content;
    }

    if (Array.isArray(value.choices)) {
      const firstChoice = value.choices[0];
      if (this.isRecord(firstChoice) && this.isRecord(firstChoice.message)) {
        const content = firstChoice.message.content;
        return this.stringifyContent(content);
      }
    }

    if (Array.isArray(value.output_text)) {
      return value.output_text
        .filter((item) => typeof item === 'string')
        .join('\n');
    }

    if (Array.isArray(value.content)) {
      return this.stringifyContent(value.content);
    }

    return null;
  }

  private stringifyContent(content: unknown): string | null {
    if (typeof content === 'string') {
      return content;
    }

    if (this.isRecord(content)) {
      return JSON.stringify(content);
    }

    if (!Array.isArray(content)) {
      return null;
    }

    const textParts = content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (!this.isRecord(item)) {
          return null;
        }

        if (typeof item.text === 'string') {
          return item.text;
        }

        if (typeof item.content === 'string') {
          return item.content;
        }

        if (this.isRecord(item.content)) {
          return JSON.stringify(item.content);
        }

        return null;
      })
      .filter((item): item is string => Boolean(item));

    return textParts.length > 0 ? textParts.join('\n') : null;
  }

  private extractJson(
    raw: unknown,
    extractedText: string | null,
    extractedContent: Record<string, unknown> | Array<unknown> | null,
  ): Record<string, unknown> | Array<unknown> | null {
    if (extractedContent) {
      return extractedContent;
    }

    if (Array.isArray(raw)) {
      return raw;
    }

    if (
      this.isRecord(raw) &&
      !Array.isArray(raw.choices) &&
      !Array.isArray(raw.content)
    ) {
      return raw;
    }

    if (!extractedText) {
      return null;
    }

    return this.parseJsonCandidate(extractedText);
  }

  private parseJsonCandidate(
    value: string,
  ): Record<string, unknown> | Array<unknown> | null {
    const candidates = [value.trim()];
    const fencedMatch = value.match(/```(?:json)?\s*([\s\S]*?)```/i);

    if (fencedMatch?.[1]) {
      candidates.push(fencedMatch[1].trim());
    }

    const objectMatch = value.match(/\{[\s\S]*\}$/);
    if (objectMatch?.[0]) {
      candidates.push(objectMatch[0].trim());
    }

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate) as unknown;
        if (Array.isArray(parsed) || this.isRecord(parsed)) {
          return parsed;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
