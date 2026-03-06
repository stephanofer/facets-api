import { Global, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { R2StorageProvider } from '@storage/providers/r2-storage.provider';
import { FileRepository } from '@storage/repositories/file.repository';
import { FileCleanupService } from '@storage/services/file-cleanup.service';
import { FileService } from '@storage/services/file.service';
import { STORAGE_PROVIDER } from '@storage/interfaces/storage-provider.interface';

@Global()
@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  ],
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useClass: R2StorageProvider,
    },
    FileRepository,
    FileService,
    FileCleanupService,
  ],
  exports: [FileService, MulterModule],
})
export class StorageModule {}
