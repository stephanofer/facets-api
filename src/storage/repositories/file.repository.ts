import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { File, Prisma } from '../../generated/prisma/client';

const DEFAULT_CLEANUP_BATCH_SIZE = 100;

@Injectable()
export class FileRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.FileUncheckedCreateInput): Promise<File> {
    return this.prisma.file.create({ data });
  }

  findActiveById(id: string): Promise<File | null> {
    return this.prisma.file.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  findActiveWorkspaceFileById(
    id: string,
    workspaceId: string,
  ): Promise<File | null> {
    return this.prisma.file.findFirst({
      where: {
        id,
        workspaceId,
        deletedAt: null,
      },
    });
  }

  markDeleted(id: string): Promise<File> {
    return this.prisma.file.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async markDeletedWorkspaceFile(
    id: string,
    workspaceId: string,
  ): Promise<File> {
    const file = await this.findActiveWorkspaceFileById(id, workspaceId);

    return this.prisma.file.update({
      where: { id: file?.id ?? id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  findPendingCleanup(
    olderThan: Date,
    limit = DEFAULT_CLEANUP_BATCH_SIZE,
  ): Promise<File[]> {
    return this.prisma.file.findMany({
      where: {
        deletedAt: {
          lt: olderThan,
        },
      },
      orderBy: {
        deletedAt: 'asc',
      },
      take: limit,
    });
  }

  async hardDelete(id: string): Promise<void> {
    await this.prisma.file.delete({
      where: { id },
    });
  }
}
