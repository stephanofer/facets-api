import {
  FileValidator,
  HttpStatus,
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common';
import { detectMimeTypeFromBuffer } from '@storage/helpers/file-key.helper';
import { FilePurpose } from '../../generated/prisma/client';

export interface UploadPurposeRule {
  maxSizeBytes: number;
  allowedMimeTypes: string[];
}

export interface FilePurposeRule extends UploadPurposeRule {
  bucket: 'public' | 'private';
  pathPrefix: string;
  presignedUrlTtl?: number;
}

export const TRANSIENT_UPLOAD_PURPOSES = {
  VOUCHER_ANALYSIS: 'VOUCHER_ANALYSIS',
} as const;

export type TransientUploadPurpose =
  (typeof TRANSIENT_UPLOAD_PURPOSES)[keyof typeof TRANSIENT_UPLOAD_PURPOSES];

export type UploadPurpose = FilePurpose | TransientUploadPurpose;

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

export const TRANSIENT_UPLOAD_PURPOSE_CONFIG: Record<
  TransientUploadPurpose,
  UploadPurposeRule
> = {
  [TRANSIENT_UPLOAD_PURPOSES.VOUCHER_ANALYSIS]: {
    maxSizeBytes: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
};

export function getFilePurposeRule(purpose: FilePurpose): FilePurposeRule {
  return FILE_PURPOSE_CONFIG[purpose];
}

export function getUploadPurposeRule(
  purpose: UploadPurpose,
): UploadPurposeRule {
  if (purpose in FILE_PURPOSE_CONFIG) {
    return FILE_PURPOSE_CONFIG[purpose as FilePurpose];
  }

  return TRANSIENT_UPLOAD_PURPOSE_CONFIG[purpose as TransientUploadPurpose];
}

export function createFileValidators(purpose: UploadPurpose): ParseFilePipe {
  const rule = getUploadPurposeRule(purpose);

  return new ParseFilePipe({
    validators: [
      new MaxFileSizeValidator({ maxSize: rule.maxSizeBytes }),
      new AllowedMimeTypesValidator(rule.allowedMimeTypes),
    ],
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  });
}

export function detectAndValidateUploadMimeType(
  purpose: UploadPurpose,
  buffer: Buffer,
): string {
  const detectedMimeType = detectMimeTypeFromBuffer(buffer);
  const rule = getUploadPurposeRule(purpose);

  if (!rule.allowedMimeTypes.includes(detectedMimeType)) {
    throw new Error(
      `Validation failed (allowed file types: ${rule.allowedMimeTypes.join(', ')})`,
    );
  }

  return detectedMimeType;
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
