import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import {
  Prisma,
  Workspace,
  WorkspaceSettings,
  WorkspaceUserPreference,
} from '@/generated/prisma/client';

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

export interface WorkspacePreferenceUpdateData {
  uiLocale?: string;
  dateFormat?: string;
  dashboardPreferences?: Prisma.InputJsonObject;
  reportPreferences?: Prisma.InputJsonObject;
  transactionPreferences?: Prisma.InputJsonObject;
}

export type WorkspaceMembershipWithWorkspace =
  Prisma.WorkspaceMembershipGetPayload<{
    include: { workspace: true };
  }>;

export type WorkspaceUserPreferenceRecord = WorkspaceUserPreference;

@Injectable()
export class WorkspacesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(workspaceId: string): Promise<WorkspaceWithSettings | null> {
    return this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { settings: true },
    });
  }

  async findAccessibleWorkspaces(
    userId: string,
  ): Promise<WorkspaceMembershipWithWorkspace[]> {
    return this.prisma.workspaceMembership.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: {
        workspace: true,
      },
      orderBy: [{ joinedAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findWorkspacePreference(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceUserPreferenceRecord | null> {
    return this.prisma.workspaceUserPreference.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });
  }

  async upsertWorkspacePreference(
    workspaceId: string,
    userId: string,
    data: WorkspacePreferenceUpdateData,
  ): Promise<WorkspaceUserPreferenceRecord> {
    return this.prisma.workspaceUserPreference.upsert({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      create: {
        workspaceId,
        userId,
        ...data,
      },
      update: data,
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
