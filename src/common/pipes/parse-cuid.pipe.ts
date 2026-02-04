import {
  PipeTransform,
  Injectable,
  BadRequestException,
  ArgumentMetadata,
} from '@nestjs/common';

/**
 * Validates that a string is a valid CUID2 format
 * CUID2 is typically 24-25 characters, lowercase alphanumeric
 */
@Injectable()
export class ParseCuidPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!this.isValidCuid(value)) {
      throw new BadRequestException(
        `Invalid ${metadata.data || 'id'} format. Expected a valid CUID.`,
      );
    }
    return value;
  }

  private isValidCuid(value: string): boolean {
    // CUID2 format: lowercase alphanumeric, typically 24-25 characters
    const cuidRegex = /^[a-z0-9]{20,26}$/;
    return cuidRegex.test(value);
  }
}
