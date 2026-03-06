/* eslint-disable @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from '@storage/interfaces/storage-provider.interface';
import { FileRepository } from '@storage/repositories/file.repository';
import { FileCleanupService } from '@storage/services/file-cleanup.service';
import { File as StoredFile, FilePurpose } from '../../generated/prisma/client';

describe('FileCleanupService', () => {
  let service: FileCleanupService;
  let storageProvider: jest.Mocked<StorageProvider>;
  let fileRepository: jest.Mocked<FileRepository>;
  let debugSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  function createStoredFile(overrides: Partial<StoredFile> = {}): StoredFile {
    return {
      id: 'file-1',
      userId: 'user-1',
      purpose: FilePurpose.AVATAR,
      bucket: 'facets-public',
      key: 'avatars/file-1.webp',
      mimeType: 'image/webp',
      size: 45200,
      originalName: 'avatar.webp',
      publicUrl: 'https://cdn.facets.test/avatars/file-1.webp',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      deletedAt: new Date('2026-03-03T00:00:00.000Z'),
      transactionId: null,
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

    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-03-05T12:00:00.000Z').getTime());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileCleanupService,
        {
          provide: STORAGE_PROVIDER,
          useValue: storageProvider,
        },
        {
          provide: FileRepository,
          useValue: fileRepository,
        },
      ],
    }).compile();

    service = module.get<FileCleanupService>(FileCleanupService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should skip cleanup when there are no pending files', async () => {
    fileRepository.findPendingCleanup.mockResolvedValue([]);

    await service.cleanupSoftDeletedFiles();

    expect(fileRepository.findPendingCleanup).toHaveBeenCalledWith(
      new Date('2026-03-04T12:00:00.000Z'),
    );
    expect(storageProvider.delete).not.toHaveBeenCalled();
    expect(fileRepository.hardDelete).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledWith(
      'No soft-deleted files pending cleanup',
    );
  });

  it('should delete soft-deleted files from storage and hard delete metadata', async () => {
    const files = [
      createStoredFile(),
      createStoredFile({
        id: 'file-2',
        key: 'avatars/file-2.webp',
      }),
    ];

    fileRepository.findPendingCleanup.mockResolvedValue(files);

    await service.cleanupSoftDeletedFiles();

    expect(logSpy).toHaveBeenCalledWith('Cleaning up 2 soft-deleted files');
    expect(storageProvider.delete).toHaveBeenNthCalledWith(
      1,
      'facets-public',
      'avatars/file-1.webp',
    );
    expect(storageProvider.delete).toHaveBeenNthCalledWith(
      2,
      'facets-public',
      'avatars/file-2.webp',
    );
    expect(fileRepository.hardDelete).toHaveBeenNthCalledWith(1, 'file-1');
    expect(fileRepository.hardDelete).toHaveBeenNthCalledWith(2, 'file-2');
  });

  it('should log cleanup errors and continue with the remaining files', async () => {
    const files = [
      createStoredFile(),
      createStoredFile({
        id: 'file-2',
        key: 'avatars/file-2.webp',
      }),
    ];
    const cleanupError = new Error('r2 delete failed');

    fileRepository.findPendingCleanup.mockResolvedValue(files);
    storageProvider.delete
      .mockRejectedValueOnce(cleanupError)
      .mockResolvedValueOnce(undefined);

    await service.cleanupSoftDeletedFiles();

    expect(fileRepository.hardDelete).toHaveBeenCalledTimes(1);
    expect(fileRepository.hardDelete).toHaveBeenCalledWith('file-2');
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to cleanup file file-1 (facets-public/avatars/file-1.webp)',
      cleanupError,
    );
  });

  it('should continue when hard delete fails after removing the object from storage', async () => {
    const files = [
      createStoredFile(),
      createStoredFile({
        id: 'file-2',
        key: 'avatars/file-2.webp',
      }),
    ];
    const hardDeleteError = new Error('db delete failed');

    fileRepository.findPendingCleanup.mockResolvedValue(files);
    storageProvider.delete.mockResolvedValue(undefined);
    fileRepository.hardDelete
      .mockRejectedValueOnce(hardDeleteError)
      .mockResolvedValueOnce(undefined);

    await service.cleanupSoftDeletedFiles();

    expect(storageProvider.delete).toHaveBeenCalledTimes(2);
    expect(fileRepository.hardDelete).toHaveBeenCalledTimes(2);
    expect(fileRepository.hardDelete).toHaveBeenNthCalledWith(1, 'file-1');
    expect(fileRepository.hardDelete).toHaveBeenNthCalledWith(2, 'file-2');
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to cleanup file file-1 (facets-public/avatars/file-1.webp)',
      hardDeleteError,
    );
  });
});
