import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import {
  FILE_PURPOSE_CONFIG,
  getFilePurposeRule,
} from '@storage/config/file-purpose.config';
import { FileResponseDto } from '@storage/dtos/file-response.dto';
import {
  buildFileKey,
  detectMimeTypeFromBuffer,
} from '@storage/helpers/file-key.helper';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from '@storage/interfaces/storage-provider.interface';
import { FileRepository } from '@storage/repositories/file.repository';
import { File, FilePurpose } from '../../generated/prisma/client';

export interface UploadFileOptions {
  transactionId?: string;
}

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
    private readonly configService: ConfigService,
    private readonly fileRepository: FileRepository,
  ) {}

  async upload(
    file: Express.Multer.File,
    purpose: FilePurpose,
    userId: string,
    options: UploadFileOptions = {},
  ): Promise<File> {
    const rule = getFilePurposeRule(purpose);
    const mimeType = detectMimeTypeFromBuffer(file.buffer);
    const bucket = this.resolveBucketName(rule.bucket);
    const key = buildFileKey(rule.pathPrefix, mimeType);
    const publicUrl =
      rule.bucket === 'public' ? this.buildPublicUrl(key) : undefined;

    await this.storageProvider.upload({
      bucket,
      key,
      body: file.buffer,
      mimeType,
    });

    try {
      return await this.fileRepository.create({
        userId,
        purpose,
        bucket,
        key,
        mimeType,
        size: file.size,
        originalName: file.originalname,
        publicUrl,
        transactionId: options.transactionId,
      });
    } catch (error) {
      await this.rollbackUploadedFile(bucket, key, error);
      throw error;
    }
  }

  async delete(fileId: string, userId: string): Promise<File> {
    const file = await this.fileRepository.findActiveById(fileId);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.userId !== userId) {
      throw new ForbiddenException('You do not have access to this file');
    }

    return this.fileRepository.markDeleted(fileId);
  }

  async toResponseDto(file: File): Promise<FileResponseDto> {
    return {
      id: file.id,
      url: await this.resolveUrl(file),
      mimeType: file.mimeType,
      size: file.size,
      purpose: file.purpose,
    };
  }

  async toResponseDtoList(files: File[]): Promise<FileResponseDto[]> {
    return Promise.all(files.map((file) => this.toResponseDto(file)));
  }

  resolveUrl(file: File): Promise<string> {
    const rule = FILE_PURPOSE_CONFIG[file.purpose];

    if (rule.bucket === 'public') {
      return Promise.resolve(file.publicUrl ?? this.buildPublicUrl(file.key));
    }

    return this.storageProvider.getPresignedUrl(
      file.bucket,
      file.key,
      rule.presignedUrlTtl ?? 900,
    );
  }

  private resolveBucketName(bucketType: 'public' | 'private'): string {
    return bucketType === 'public'
      ? this.getRequiredStorageValue(
          this.configService.storage.publicBucket,
          'R2_PUBLIC_BUCKET',
        )
      : this.getRequiredStorageValue(
          this.configService.storage.privateBucket,
          'R2_PRIVATE_BUCKET',
        );
  }

  private buildPublicUrl(key: string): string {
    const baseUrl = this.getRequiredStorageValue(
      this.configService.storage.publicUrl,
      'R2_PUBLIC_URL',
    ).replace(/\/+$/, '');

    return `${baseUrl}/${key}`;
  }

  private async rollbackUploadedFile(
    bucket: string,
    key: string,
    originalError: unknown,
  ): Promise<void> {
    try {
      await this.storageProvider.delete(bucket, key);
    } catch (rollbackError) {
      this.logger.error(
        `Failed to rollback uploaded file ${bucket}/${key}`,
        this.getErrorStack(rollbackError),
      );
    }

    this.logger.error(
      `Failed to persist uploaded file metadata for ${bucket}/${key}`,
      this.getErrorStack(originalError),
    );
  }

  private getRequiredStorageValue(
    value: string | undefined,
    key: string,
  ): string {
    if (!value) {
      throw new Error(`Missing required storage configuration: ${key}`);
    }

    return value;
  }

  private getErrorStack(error: unknown): string {
    if (error instanceof Error) {
      return error.stack ?? error.message;
    }

    return String(error);
  }
}
