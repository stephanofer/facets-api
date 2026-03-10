import {
  FileValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common';
import {
  createFileValidators,
  detectAndValidateUploadMimeType,
  FILE_PURPOSE_CONFIG,
  getFilePurposeRule,
  getUploadPurposeRule,
  TRANSIENT_UPLOAD_PURPOSES,
} from '@storage/config/file-purpose.config';
import { FilePurpose } from '../../generated/prisma/client';

describe('file-purpose.config', () => {
  describe('getFilePurposeRule', () => {
    it('should expose the configured avatar rule', () => {
      expect(getFilePurposeRule(FilePurpose.AVATAR)).toEqual(
        FILE_PURPOSE_CONFIG[FilePurpose.AVATAR],
      );
    });

    it('should expose the configured transaction receipt rule', () => {
      expect(getFilePurposeRule(FilePurpose.TRANSACTION_RECEIPT)).toEqual(
        FILE_PURPOSE_CONFIG[FilePurpose.TRANSACTION_RECEIPT],
      );
    });

    it('should expose the configured voucher analysis rule', () => {
      expect(
        getUploadPurposeRule(TRANSIENT_UPLOAD_PURPOSES.VOUCHER_ANALYSIS),
      ).toEqual({
        maxSizeBytes: 5 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });
    });
  });

  describe('createFileValidators', () => {
    it('should build a parse file pipe for avatars with size and type validators', () => {
      const pipe = createFileValidators(FilePurpose.AVATAR);
      const validators = pipe.getValidators();

      expect(pipe).toBeInstanceOf(ParseFilePipe);
      expect(validators).toHaveLength(2);
      expect(validators[0]).toBeInstanceOf(MaxFileSizeValidator);
      expect(validators[1]).toBeInstanceOf(FileValidator);
      expect(
        (
          validators[0] as MaxFileSizeValidator & {
            validationOptions: { maxSize: number };
          }
        ).validationOptions.maxSize,
      ).toBe(2 * 1024 * 1024);
    });

    it('should allow only the configured mime types for transaction receipts', () => {
      const pipe = createFileValidators(FilePurpose.TRANSACTION_RECEIPT);
      const validators = pipe.getValidators();
      const mimeTypeValidator = validators[1] as FileValidator;

      expect(
        mimeTypeValidator.isValid({
          mimetype: 'image/jpeg',
        } as Express.Multer.File),
      ).toBe(true);
      expect(
        mimeTypeValidator.isValid({
          mimetype: 'application/pdf',
        } as Express.Multer.File),
      ).toBe(true);
      expect(
        mimeTypeValidator.isValid({
          mimetype: 'image/svg+xml',
        } as Express.Multer.File),
      ).toBe(false);
    });

    it('should require a file by default', async () => {
      const pipe = createFileValidators(FilePurpose.AVATAR);

      await expect(pipe.transform(undefined)).rejects.toThrow(
        'File is required',
      );
    });

    it('should reject oversized voucher analysis images', async () => {
      const pipe = createFileValidators(
        TRANSIENT_UPLOAD_PURPOSES.VOUCHER_ANALYSIS,
      );

      await expect(
        pipe.transform({
          size: 5 * 1024 * 1024 + 1,
          mimetype: 'image/png',
        } as Express.Multer.File),
      ).rejects.toThrow(
        'Validation failed (current file size is 5242881, expected size is less than 5242880)',
      );
    });

    it('should allow only image mime types for voucher analysis', () => {
      const pipe = createFileValidators(
        TRANSIENT_UPLOAD_PURPOSES.VOUCHER_ANALYSIS,
      );
      const validators = pipe.getValidators();
      const mimeTypeValidator = validators[1] as FileValidator;

      expect(
        mimeTypeValidator.isValid({
          mimetype: 'image/png',
        } as Express.Multer.File),
      ).toBe(true);
      expect(
        mimeTypeValidator.isValid({
          mimetype: 'application/pdf',
        } as Express.Multer.File),
      ).toBe(false);
    });
  });

  describe('detectAndValidateUploadMimeType', () => {
    it('should detect a valid voucher analysis image from magic bytes', () => {
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);

      expect(
        detectAndValidateUploadMimeType(
          TRANSIENT_UPLOAD_PURPOSES.VOUCHER_ANALYSIS,
          buffer,
        ),
      ).toBe('image/jpeg');
    });

    it('should throw when the buffer content does not match allowed voucher analysis types', () => {
      const buffer = Buffer.from('%PDF-1.7');

      expect(() =>
        detectAndValidateUploadMimeType(
          TRANSIENT_UPLOAD_PURPOSES.VOUCHER_ANALYSIS,
          buffer,
        ),
      ).toThrow(
        'Validation failed (allowed file types: image/jpeg, image/png, image/webp)',
      );
    });
  });
});
