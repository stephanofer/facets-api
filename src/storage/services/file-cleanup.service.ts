import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from '@storage/interfaces/storage-provider.interface';
import { FileRepository } from '@storage/repositories/file.repository';

const FILE_RETENTION_HOURS = 24;

@Injectable()
export class FileCleanupService {
  private readonly logger = new Logger(FileCleanupService.name);

  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
    private readonly fileRepository: FileRepository,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async cleanupSoftDeletedFiles(): Promise<void> {
    const cutoff = new Date(Date.now() - FILE_RETENTION_HOURS * 60 * 60 * 1000);
    const files = await this.fileRepository.findPendingCleanup(cutoff);

    if (files.length === 0) {
      this.logger.debug('No soft-deleted files pending cleanup');
      return;
    }

    this.logger.log(`Cleaning up ${files.length} soft-deleted files`);

    for (const file of files) {
      try {
        await this.storageProvider.delete(file.bucket, file.key);
        await this.fileRepository.hardDelete(file.id);
      } catch (error) {
        this.logger.error(
          `Failed to cleanup file ${file.id} (${file.bucket}/${file.key})`,
          error,
        );
      }
    }
  }
}
