import * as crypto from 'node:crypto';

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46];
const WEBP_RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46];
const WEBP_WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50];

export const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export function buildFileKey(pathPrefix: string, mimeType: string): string {
  const extension = getExtensionFromMimeType(mimeType);
  return `${trimSlashes(pathPrefix)}/${crypto.randomUUID()}.${extension}`;
}

export function getExtensionFromMimeType(mimeType: string): string {
  const extension = MIME_TO_EXTENSION[mimeType];

  if (!extension) {
    throw new Error(`Unsupported mime type: ${mimeType}`);
  }

  return extension;
}

export function detectMimeTypeFromBuffer(buffer: Buffer): string {
  if (startsWithSignature(buffer, JPEG_SIGNATURE)) {
    return 'image/jpeg';
  }

  if (startsWithSignature(buffer, PNG_SIGNATURE)) {
    return 'image/png';
  }

  if (
    startsWithSignature(buffer, WEBP_RIFF_SIGNATURE) &&
    hasSignatureAt(buffer, WEBP_WEBP_SIGNATURE, 8)
  ) {
    return 'image/webp';
  }

  if (startsWithSignature(buffer, PDF_SIGNATURE)) {
    return 'application/pdf';
  }

  throw new Error('Unable to determine file mime type from content');
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function startsWithSignature(buffer: Buffer, signature: number[]): boolean {
  return hasSignatureAt(buffer, signature, 0);
}

function hasSignatureAt(
  buffer: Buffer,
  signature: number[],
  offset: number,
): boolean {
  if (buffer.length < offset + signature.length) {
    return false;
  }

  return signature.every((byte, index) => buffer[offset + index] === byte);
}
