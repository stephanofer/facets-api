import { MODULE_METADATA } from '@nestjs/common/constants';
import { MulterModule } from '@nestjs/platform-express';
import { MULTER_MODULE_OPTIONS } from '@nestjs/platform-express/multer/files.constants';
import { StorageModule } from '@storage/storage.module';
import { FileService } from '@storage/services/file.service';

describe('StorageModule', () => {
  it('should register Multer with memory storage and a 10MB global safety limit', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      StorageModule,
    ) as Array<{
      module: unknown;
      providers?: Array<{ provide: unknown; useFactory?: () => unknown }>;
    }>;
    const multerImport = imports.find((item) => item.module === MulterModule);
    const optionsProvider = multerImport?.providers?.find(
      (provider) => provider.provide === MULTER_MODULE_OPTIONS,
    );
    const multerOptions = optionsProvider?.useFactory?.() as {
      limits: { fileSize: number };
      storage: {
        _handleFile: unknown;
        _removeFile: unknown;
      };
    };

    expect(multerImport).toBeDefined();
    expect(multerOptions.limits.fileSize).toBe(10 * 1024 * 1024);
    expect(typeof multerOptions.storage._handleFile).toBe('function');
    expect(typeof multerOptions.storage._removeFile).toBe('function');
  });

  it('should export FileService and MulterModule', () => {
    const exportsMetadata = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      StorageModule,
    ) as unknown[];

    expect(exportsMetadata).toEqual(
      expect.arrayContaining([FileService, MulterModule]),
    );
  });
});
