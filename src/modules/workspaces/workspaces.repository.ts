import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { Workspace, WorkspaceSettings } from '@/generated/prisma/client';

export type WorkspaceWithSettings = Workspace & {
  settings: Omit<WorkspaceSettings, 'displayLabel'> | null;
};

export interface WorkspaceSettingsUpdateData {
  baseCurrencyCode?: string;
  contentLocale?: string;
  dateFormat?: string;
  monthStartDay?: number;
  weekStartDay?: number;
  financialTimezone?: string;
}

export interface WorkspaceUpdateData {
  name?: Workspace['name'];
}

@Injectable()
export class WorkspacesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(workspaceId: string): Promise<WorkspaceWithSettings | null> {
    return this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { settings: true },
    });
  }

  async updateWorkspace(
    workspaceId: string,
    data: WorkspaceUpdateData,
  ): Promise<WorkspaceWithSettings> {
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data,
    });

    return this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: { settings: true },
    });
  }

  async updateSettings(
    workspaceId: string,
    data: WorkspaceSettingsUpdateData,
  ): Promise<WorkspaceWithSettings> {
    await this.prisma.workspaceSettings.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        ...data,
      },
      update: data,
    });

    return this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: { settings: true },
    });
  }
}
