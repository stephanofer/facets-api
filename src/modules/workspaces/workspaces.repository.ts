import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { Workspace, WorkspaceSettings } from '../../generated/prisma/client';

export type WorkspaceWithSettings = Workspace & {
  settings: WorkspaceSettings | null;
};

export interface WorkspaceSettingsUpdateData {
  baseCurrencyCode?: string;
  contentLocale?: string;
  dateFormat?: string;
  monthStartDay?: number;
  weekStartDay?: number;
  financialTimezone?: string;
  displayLabel?: string;
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

  async updateSettings(
    workspaceId: string,
    data: {
      workspaceType?: Workspace['type'];
      settings?: WorkspaceSettingsUpdateData;
    },
  ): Promise<WorkspaceWithSettings> {
    return this.prisma.$transaction(async (tx) => {
      if (data.workspaceType !== undefined) {
        await tx.workspace.update({
          where: { id: workspaceId },
          data: { type: data.workspaceType },
        });
      }

      if (data.settings && Object.keys(data.settings).length > 0) {
        await tx.workspaceSettings.upsert({
          where: { workspaceId },
          create: {
            workspaceId,
            displayLabel: 'Workspace',
            ...data.settings,
          },
          update: data.settings,
        });
      }

      return tx.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        include: { settings: true },
      });
    });
  }
}
