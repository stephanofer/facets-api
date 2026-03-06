import { FileRepository } from '@storage/repositories/file.repository';
import { PrismaService } from '@database/prisma.service';
import { FilePurpose } from '../../generated/prisma/client';

describe('FileRepository', () => {
  let repository: FileRepository;
  let prismaService: {
    file: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaService = {
      file: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    repository = new FileRepository(prismaService as unknown as PrismaService);
  });

  it('should create files through Prisma', async () => {
    const data = {
      userId: 'user-1',
      purpose: FilePurpose.AVATAR,
      bucket: 'facets-public',
      key: 'avatars/file.webp',
      mimeType: 'image/webp',
      size: 123,
      originalName: 'avatar.webp',
    };

    await repository.create(data as never);

    expect(prismaService.file.create).toHaveBeenCalledWith({ data });
  });

  it('should find only active files by id', async () => {
    await repository.findActiveById('file-1');

    expect(prismaService.file.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'file-1',
        deletedAt: null,
      },
    });
  });

  it('should mark files as deleted', async () => {
    await repository.markDeleted('file-1');

    const [[updateArgs]] = prismaService.file.update.mock.calls as [
      [{ where: { id: string }; data: { deletedAt: Date } }],
    ];

    expect(updateArgs.where).toEqual({ id: 'file-1' });
    expect(updateArgs.data.deletedAt).toBeInstanceOf(Date);
  });

  it('should query pending cleanup files with default batch size', async () => {
    const cutoff = new Date('2026-03-05T12:00:00.000Z');

    await repository.findPendingCleanup(cutoff);

    expect(prismaService.file.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: {
          lt: cutoff,
        },
      },
      orderBy: {
        deletedAt: 'asc',
      },
      take: 100,
    });
  });

  it('should honor a custom cleanup batch size', async () => {
    const cutoff = new Date('2026-03-05T12:00:00.000Z');

    await repository.findPendingCleanup(cutoff, 25);

    expect(prismaService.file.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: {
          lt: cutoff,
        },
      },
      orderBy: {
        deletedAt: 'asc',
      },
      take: 25,
    });
  });

  it('should hard delete files', async () => {
    await repository.hardDelete('file-1');

    expect(prismaService.file.delete).toHaveBeenCalledWith({
      where: { id: 'file-1' },
    });
  });
});
