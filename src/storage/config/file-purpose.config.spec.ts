import {
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common';
import {
  createFileValidators,
  FILE_PURPOSE_CONFIG,
  getFilePurposeRule,
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
  });

  describe('createFileValidators', () => {
    it('should build a parse file pipe for avatars with size and type validators', () => {
      const pipe = createFileValidators(FilePurpose.AVATAR);
      const validators = pipe.getValidators();

      expect(pipe).toBeInstanceOf(ParseFilePipe);
      expect(validators).toHaveLength(2);
      expect(validators[0]).toBeInstanceOf(MaxFileSizeValidator);
      expect(validators[1]).toBeInstanceOf(FileTypeValidator);
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
      const fileTypeValidator = validators[1] as FileTypeValidator & {
        validationOptions: { fileType: RegExp };
      };

      expect(
        fileTypeValidator.validationOptions.fileType.test('image/jpeg'),
      ).toBe(true);
      expect(
        fileTypeValidator.validationOptions.fileType.test('application/pdf'),
      ).toBe(true);
      expect(
        fileTypeValidator.validationOptions.fileType.test('image/svg+xml'),
      ).toBe(false);
    });

    it('should require a file by default', async () => {
      const pipe = createFileValidators(FilePurpose.AVATAR);

      await expect(pipe.transform(undefined)).rejects.toThrow(
        'File is required',
      );
    });
  });
});
