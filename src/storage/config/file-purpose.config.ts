import {
  FileTypeValidator,
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
  const fileTypePattern = new RegExp(
    `^(${rule.allowedMimeTypes.map(escapeRegExp).join('|')})$`,
  );

  return new ParseFilePipe({
    validators: [
      new MaxFileSizeValidator({ maxSize: rule.maxSizeBytes }),
      new FileTypeValidator({ fileType: fileTypePattern }),
    ],
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
