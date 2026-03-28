/* eslint-disable @typescript-eslint/unbound-method */
import * as crypto from 'node:crypto';

import { Logger, NotFoundException } from '@nestjs/common';
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

  const workspaceId = 'workspace-1';
  const uploadedByUserId = 'user-1';

  function createStoredFile(overrides: Partial<StoredFile> = {}): StoredFile {
    return {
      id: 'file-1',
      workspaceId,
      uploadedByUserId,
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
      ...overrides,
    } as StoredFile;
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
      findActiveAvatarById: jest.fn(),
      findActiveWorkspaceFileById: jest.fn(),
      markDeleted: jest.fn(),
      markDeletedAvatar: jest.fn(),
      markDeletedWorkspaceFile: jest.fn(),
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
    it('should upload public avatar files and persist workspace ownership metadata', async () => {
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

      const result = await service.upload(file, FilePurpose.AVATAR, {
        workspaceId,
        uploadedByUserId,
      });

      expect(fileRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          uploadedByUserId,
          purpose: FilePurpose.AVATAR,
        }),
      );
      expect(result).toBe(persistedFile);
    });

    it('should rollback the uploaded object when metadata persistence fails', async () => {
      const file = createMulterFile(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      const persistenceError = new Error('db failed');

      jest
        .spyOn(crypto, 'randomUUID')
        .mockReturnValue('33333333-3333-4333-8333-333333333333');
      fileRepository.create.mockRejectedValue(persistenceError);

      await expect(
        service.upload(file, FilePurpose.AVATAR, {
          workspaceId,
          uploadedByUserId,
        }),
      ).rejects.toThrow(persistenceError);

      expect(storageProvider.delete).toHaveBeenCalled();
    });
  });

  describe('deleteAvatar', () => {
    it('should soft delete files uploaded by the current user', async () => {
      const file = createStoredFile();
      const deletedFile = createStoredFile({ deletedAt: new Date() });

      fileRepository.findActiveAvatarById.mockResolvedValue(file);
      fileRepository.markDeletedAvatar.mockResolvedValue(deletedFile);

      const result = await service.deleteAvatar(file.id, { uploadedByUserId });

      expect(result).toBe(deletedFile);
    });

    it('should throw when the file does not exist', async () => {
      fileRepository.findActiveAvatarById.mockResolvedValue(null);

      await expect(
        service.deleteAvatar('missing-file', { uploadedByUserId }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteWorkspaceFile', () => {
    it('should soft delete files from the active workspace', async () => {
      const file = createStoredFile();
      const deletedFile = createStoredFile({ deletedAt: new Date() });

      fileRepository.findActiveWorkspaceFileById.mockResolvedValue(file);
      fileRepository.markDeletedWorkspaceFile.mockResolvedValue(deletedFile);

      const result = await service.deleteWorkspaceFile(file.id, {
        workspaceId,
      });

      expect(result).toBe(deletedFile);
    });

    it('should throw when the workspace file does not exist', async () => {
      fileRepository.findActiveWorkspaceFileById.mockResolvedValue(null);

      await expect(
        service.deleteWorkspaceFile('missing-file', { workspaceId }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
