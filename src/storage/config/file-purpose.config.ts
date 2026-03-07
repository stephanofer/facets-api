import {
  FileValidator,
  HttpStatus,
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common';
import { FilePurpose } from '../../generated/prisma/client';

export interface FilePurposeRule {
  maxSizeBytes: number;
  allowedMimeTypes: string[];
  bucket: 'public' | 'private';
  pathPrefix: string;
  presignedUrlTtl?: number;
}

export const FILE_PURPOSE_CONFIG: Record<FilePurpose, FilePurposeRule> = {
  [FilePurpose.AVATAR]: {
    maxSizeBytes: 2 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    bucket: 'public',
    pathPrefix: 'avatars',
  },
  [FilePurpose.TRANSACTION_RECEIPT]: {
    maxSizeBytes: 5 * 1024 * 1024,
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ],
    bucket: 'private',
    pathPrefix: 'receipts',
    presignedUrlTtl: 900,
  },
};

export function getFilePurposeRule(purpose: FilePurpose): FilePurposeRule {
  return FILE_PURPOSE_CONFIG[purpose];
}

export function createFileValidators(purpose: FilePurpose): ParseFilePipe {
  const rule = getFilePurposeRule(purpose);

  return new ParseFilePipe({
    validators: [
      new MaxFileSizeValidator({ maxSize: rule.maxSizeBytes }),
      new AllowedMimeTypesValidator(rule.allowedMimeTypes),
    ],
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  });
}

class AllowedMimeTypesValidator extends FileValidator<{
  allowedMimeTypes: string[];
}> {
  constructor(allowedMimeTypes: string[]) {
    super({ allowedMimeTypes });
  }

  override isValid(file?: Express.Multer.File): boolean {
    if (!file) {
      return false;
    }

    return this.validationOptions.allowedMimeTypes.includes(file.mimetype);
  }

  override buildErrorMessage(): string {
    return `Validation failed (allowed file types: ${this.validationOptions.allowedMimeTypes.join(', ')})`;
  }
}
