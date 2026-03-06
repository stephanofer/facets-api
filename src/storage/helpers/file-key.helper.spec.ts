import * as crypto from 'node:crypto';

import {
  buildFileKey,
  detectMimeTypeFromBuffer,
  getExtensionFromMimeType,
} from '@storage/helpers/file-key.helper';

describe('file-key.helper', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('buildFileKey', () => {
    it('should generate a normalized key with the extension derived from mime type', () => {
      jest
        .spyOn(crypto, 'randomUUID')
        .mockReturnValue('55555555-5555-4555-8555-555555555555');

      const key = buildFileKey('/avatars/', 'image/webp');

      expect(key).toBe('avatars/55555555-5555-4555-8555-555555555555.webp');
    });
  });

  describe('getExtensionFromMimeType', () => {
    it('should resolve the expected extension', () => {
      expect(getExtensionFromMimeType('application/pdf')).toBe('pdf');
    });

    it('should throw for unsupported mime types', () => {
      expect(() => getExtensionFromMimeType('image/svg+xml')).toThrow(
        'Unsupported mime type: image/svg+xml',
      );
    });
  });

  describe('detectMimeTypeFromBuffer', () => {
    it('should detect jpeg files from magic bytes', () => {
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);

      expect(detectMimeTypeFromBuffer(buffer)).toBe('image/jpeg');
    });

    it('should detect png files from magic bytes', () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

      expect(detectMimeTypeFromBuffer(buffer)).toBe('image/png');
    });

    it('should detect webp files from magic bytes', () => {
      const buffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]);

      expect(detectMimeTypeFromBuffer(buffer)).toBe('image/webp');
    });

    it('should detect pdf files from magic bytes', () => {
      const buffer = Buffer.from('%PDF-1.7');

      expect(detectMimeTypeFromBuffer(buffer)).toBe('application/pdf');
    });

    it('should throw when the mime type cannot be detected', () => {
      const buffer = Buffer.from('not-a-supported-file');

      expect(() => detectMimeTypeFromBuffer(buffer)).toThrow(
        'Unable to determine file mime type from content',
      );
    });
  });
});
