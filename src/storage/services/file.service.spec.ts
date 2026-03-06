/* eslint-disable @typescript-eslint/unbound-method */
import * as crypto from 'node:crypto';

import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@config/config.service';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from '@storage/interfaces/storage-provider.interface';
import { FileRepository } from '@storage/repositories/file.repository';
import { FileService } from '@storage/services/file.service';
import { File as StoredFile, FilePurpose } from '../../generated/prisma/client';

describe('FileService', () => {
  let service: FileService;
  let storageProvider: jest.Mocked<StorageProvider>;
  let fileRepository: jest.Mocked<FileRepository>;
  let errorSpy: jest.SpyInstance;

  const configService = {
    storage: {
      publicBucket: 'facets-public',
      privateBucket: 'facets-private',
      publicUrl: 'https://cdn.facets.test/',
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
      endpoint: 'https://account-id.r2.cloudflarestorage.com',
    },
  } as ConfigService;

  const userId = 'user-1';

  function createStoredFile(overrides: Partial<StoredFile> = {}): StoredFile {
    return {
      id: 'file-1',
      userId,
      purpose: FilePurpose.AVATAR,
      bucket: 'facets-public',
      key: 'avatars/file-1.webp',
      mimeType: 'image/webp',
      size: 45200,
      originalName: 'avatar.png',
      publicUrl: 'https://cdn.facets.test/avatars/file-1.webp',
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
      updatedAt: new Date('2026-03-05T00:00:00.000Z'),
      deletedAt: null,
      transactionId: null,
      ...overrides,
    };
  }

  function createMulterFile(
    buffer: Buffer,
    overrides: Partial<Express.Multer.File> = {},
  ): Express.Multer.File {
    return {
      fieldname: 'file',
      originalname: 'upload.bin',
      encoding: '7bit',
      mimetype: 'application/octet-stream',
      size: buffer.length,
      destination: '',
      filename: '',
      path: '',
      stream: undefined as never,
      buffer,
      ...overrides,
    };
  }

  beforeEach(async () => {
    storageProvider = {
      upload: jest.fn(),
      delete: jest.fn(),
      getPresignedUrl: jest.fn(),
    };

    fileRepository = {
      create: jest.fn(),
      findActiveById: jest.fn(),
      markDeleted: jest.fn(),
      findPendingCleanup: jest.fn(),
      hardDelete: jest.fn(),
    } as unknown as jest.Mocked<FileRepository>;

    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        {
          provide: STORAGE_PROVIDER,
          useValue: storageProvider,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: FileRepository,
          useValue: fileRepository,
        },
      ],
    }).compile();

    service = module.get<FileService>(FileService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('upload', () => {
    it('should upload public avatar files and persist a direct public URL', async () => {
      const file = createMulterFile(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]),
        {
          originalname: 'avatar.png',
        },
      );
      const persistedFile = createStoredFile({
        key: 'avatars/avatar-uuid.png',
        mimeType: 'image/png',
        size: file.size,
        originalName: file.originalname,
        publicUrl: 'https://cdn.facets.test/avatars/avatar-uuid.png',
      });

      jest
        .spyOn(crypto, 'randomUUID')
        .mockReturnValue('11111111-1111-4111-8111-111111111111');
      fileRepository.create.mockResolvedValue(persistedFile);

      const result = await service.upload(file, FilePurpose.AVATAR, userId);

      expect(storageProvider.upload).toHaveBeenCalledWith({
        bucket: 'facets-public',
        key: 'avatars/11111111-1111-4111-8111-111111111111.png',
        body: file.buffer,
        mimeType: 'image/png',
      });
      expect(fileRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          purpose: FilePurpose.AVATAR,
          bucket: 'facets-public',
          key: 'avatars/11111111-1111-4111-8111-111111111111.png',
          mimeType: 'image/png',
          size: file.size,
          originalName: 'avatar.png',
          publicUrl:
            'https://cdn.facets.test/avatars/11111111-1111-4111-8111-111111111111.png',
        }),
      );
      expect(result).toBe(persistedFile);
    });

    it('should upload private receipt files without storing a public URL', async () => {
      const file = createMulterFile(Buffer.from('%PDF-1.7'), {
        originalname: 'receipt.pdf',
      });
      const persistedFile = createStoredFile({
        purpose: FilePurpose.TRANSACTION_RECEIPT,
        bucket: 'facets-private',
        key: 'receipts/receipt-uuid.pdf',
        mimeType: 'application/pdf',
        size: file.size,
        originalName: file.originalname,
        publicUrl: null,
        transactionId: 'txn-1',
      });

      jest
        .spyOn(crypto, 'randomUUID')
        .mockReturnValue('22222222-2222-4222-8222-222222222222');
      fileRepository.create.mockResolvedValue(persistedFile);

      const result = await service.upload(
        file,
        FilePurpose.TRANSACTION_RECEIPT,
        userId,
        { transactionId: 'txn-1' },
      );

      expect(storageProvider.upload).toHaveBeenCalledWith({
        bucket: 'facets-private',
        key: 'receipts/22222222-2222-4222-8222-222222222222.pdf',
        body: file.buffer,
        mimeType: 'application/pdf',
      });
      expect(fileRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket: 'facets-private',
          key: 'receipts/22222222-2222-4222-8222-222222222222.pdf',
          publicUrl: undefined,
          transactionId: 'txn-1',
        }),
      );
      expect(result).toBe(persistedFile);
    });

    it('should rollback the uploaded object when metadata persistence fails', async () => {
      const file = createMulterFile(Buffer.from('%PDF-1.7'));
      const persistenceError = new Error('db failed');

      jest
        .spyOn(crypto, 'randomUUID')
        .mockReturnValue('33333333-3333-4333-8333-333333333333');
      fileRepository.create.mockRejectedValue(persistenceError);

      await expect(
        service.upload(file, FilePurpose.TRANSACTION_RECEIPT, userId),
      ).rejects.toThrow(persistenceError);

      expect(storageProvider.delete).toHaveBeenCalledWith(
        'facets-private',
        'receipts/33333333-3333-4333-8333-333333333333.pdf',
      );
    });

    it('should log rollback failures and rethrow the original persistence error', async () => {
      const file = createMulterFile(Buffer.from('%PDF-1.7'));
      const persistenceError = new Error('db failed');
      const rollbackError = new Error('r2 delete failed');

      jest
        .spyOn(crypto, 'randomUUID')
        .mockReturnValue('44444444-4444-4444-8444-444444444444');
      fileRepository.create.mockRejectedValue(persistenceError);
      storageProvider.delete.mockRejectedValue(rollbackError);

      await expect(
        service.upload(file, FilePurpose.TRANSACTION_RECEIPT, userId),
      ).rejects.toThrow(persistenceError);

      expect(errorSpy).toHaveBeenNthCalledWith(
        1,
        'Failed to rollback uploaded file facets-private/receipts/44444444-4444-4444-8444-444444444444.pdf',
        rollbackError.stack,
      );
      expect(errorSpy).toHaveBeenNthCalledWith(
        2,
        'Failed to persist uploaded file metadata for facets-private/receipts/44444444-4444-4444-8444-444444444444.pdf',
        persistenceError.stack,
      );
    });

    it('should fail fast when the file content is not a supported type', async () => {
      const file = createMulterFile(Buffer.from('not-a-supported-file'));

      await expect(
        service.upload(file, FilePurpose.AVATAR, userId),
      ).rejects.toThrow('Unable to determine file mime type from content');

      expect(storageProvider.upload).not.toHaveBeenCalled();
      expect(fileRepository.create).not.toHaveBeenCalled();
    });

    it('should fail before upload when the target bucket configuration is missing', async () => {
      const misconfiguredService = new FileService(
        storageProvider,
        {
          storage: {
            ...configService.storage,
            privateBucket: undefined,
          },
        } as ConfigService,
        fileRepository,
      );

      await expect(
        misconfiguredService.upload(
          createMulterFile(Buffer.from('%PDF-1.7')),
          FilePurpose.TRANSACTION_RECEIPT,
          userId,
        ),
      ).rejects.toThrow(
        'Missing required storage configuration: R2_PRIVATE_BUCKET',
      );

      expect(storageProvider.upload).not.toHaveBeenCalled();
      expect(fileRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete files owned by the current user', async () => {
      const file = createStoredFile();
      const deletedFile = createStoredFile({ deletedAt: new Date() });

      fileRepository.findActiveById.mockResolvedValue(file);
      fileRepository.markDeleted.mockResolvedValue(deletedFile);

      const result = await service.delete(file.id, userId);

      expect(fileRepository.markDeleted).toHaveBeenCalledWith(file.id);
      expect(result).toBe(deletedFile);
    });

    it('should throw when the file does not exist', async () => {
      fileRepository.findActiveById.mockResolvedValue(null);

      await expect(service.delete('missing-file', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw when the file belongs to another user', async () => {
      fileRepository.findActiveById.mockResolvedValue(
        createStoredFile({ userId: 'another-user' }),
      );

      await expect(service.delete('file-1', userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('resolveUrl', () => {
    it('should return the persisted public URL for public files', async () => {
      const file = createStoredFile();

      await expect(service.resolveUrl(file)).resolves.toBe(file.publicUrl);
      expect(storageProvider.getPresignedUrl).not.toHaveBeenCalled();
    });

    it('should rebuild the public URL when it is missing', async () => {
      const file = createStoredFile({
        key: 'avatars/rebuilt.webp',
        publicUrl: null,
      });

      await expect(service.resolveUrl(file)).resolves.toBe(
        'https://cdn.facets.test/avatars/rebuilt.webp',
      );
    });

    it('should fail when rebuilding a public URL without the public base URL configured', () => {
      const misconfiguredService = new FileService(
        storageProvider,
        {
          storage: {
            ...configService.storage,
            publicUrl: undefined,
          },
        } as ConfigService,
        fileRepository,
      );

      expect(() =>
        misconfiguredService.resolveUrl(
          createStoredFile({ publicUrl: null, key: 'avatars/missing.webp' }),
        ),
      ).toThrow('Missing required storage configuration: R2_PUBLIC_URL');
    });

    it('should generate a presigned URL for private files', async () => {
      const file = createStoredFile({
        purpose: FilePurpose.TRANSACTION_RECEIPT,
        bucket: 'facets-private',
        key: 'receipts/private.pdf',
        mimeType: 'application/pdf',
        publicUrl: null,
      });

      storageProvider.getPresignedUrl.mockResolvedValue(
        'https://signed.facets.test/private.pdf',
      );

      await expect(service.resolveUrl(file)).resolves.toBe(
        'https://signed.facets.test/private.pdf',
      );
      expect(storageProvider.getPresignedUrl).toHaveBeenCalledWith(
        'facets-private',
        'receipts/private.pdf',
        900,
      );
    });
  });

  describe('response mapping', () => {
    it('should map a file entity into the standardized response DTO', async () => {
      const file = createStoredFile();

      await expect(service.toResponseDto(file)).resolves.toEqual({
        id: file.id,
        url: file.publicUrl,
        mimeType: file.mimeType,
        size: file.size,
        purpose: file.purpose,
      });
    });

    it('should map a list of file entities into standardized response DTOs', async () => {
      const files = [
        createStoredFile(),
        createStoredFile({
          id: 'file-2',
          key: 'avatars/file-2.webp',
          publicUrl: 'https://cdn.facets.test/avatars/file-2.webp',
        }),
      ];

      const result = await service.toResponseDtoList(files);

      expect(result).toEqual([
        {
          id: 'file-1',
          url: 'https://cdn.facets.test/avatars/file-1.webp',
          mimeType: 'image/webp',
          size: 45200,
          purpose: FilePurpose.AVATAR,
        },
        {
          id: 'file-2',
          url: 'https://cdn.facets.test/avatars/file-2.webp',
          mimeType: 'image/webp',
          size: 45200,
          purpose: FilePurpose.AVATAR,
        },
      ]);
    });
  });
});
