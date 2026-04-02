import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@common/constants/app.constants';
import { BusinessException } from '@common/exceptions/business.exception';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import { UpdateWorkspaceDto } from '@modules/workspaces/dtos/update-workspace.dto';
import { UpdateWorkspacePreferencesDto } from '@modules/workspaces/dtos/update-workspace-preferences.dto';
import { UpdateWorkspaceSettingsDto } from '@modules/workspaces/dtos/update-workspace-settings.dto';
import {
  CurrentWorkspaceResponseDto,
  WorkspaceDirectoryItemDto,
  WorkspaceSettingsDto,
  WorkspaceSettingsResponseDto,
} from '@modules/workspaces/dtos/workspace-response.dto';
import { WorkspacePreferencesResponseDto } from '@modules/workspaces/dtos/workspace-preferences-response.dto';
import {
  WorkspaceMembershipWithWorkspace,
  WorkspacePreferenceUpdateData,
  WorkspacesRepository,
  WorkspaceWithSettings,
} from '@modules/workspaces/workspaces.repository';
import { Prisma } from '@/generated/prisma/client';

@Injectable()
export class WorkspacesService {
  constructor(private readonly workspacesRepository: WorkspacesRepository) {}

  async getCurrentWorkspace(
    principal: AuthenticatedPrincipal,
  ): Promise<CurrentWorkspaceResponseDto> {
    const workspace = await this.findWorkspaceOrThrow(principal.workspaceId);

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
        status: workspace.status,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
      membership: {
        id: principal.membership.id,
        role: principal.membership.role,
        status: principal.membership.status,
        joinedAt: principal.membership.joinedAt,
      },
      settings: this.toSettingsDto(workspace),
    };
  }

  async getCurrentWorkspaceSettings(
    principal: AuthenticatedPrincipal,
  ): Promise<WorkspaceSettingsResponseDto> {
    const workspace = await this.findWorkspaceOrThrow(principal.workspaceId);

    return {
      settings: this.toSettingsDto(workspace),
    };
  }

  async listWorkspaces(
    principal: AuthenticatedPrincipal,
  ): Promise<WorkspaceDirectoryItemDto[]> {
    const memberships =
      await this.workspacesRepository.findAccessibleWorkspaces(principal.sub);

    return memberships.map((membership) =>
      this.toWorkspaceDirectoryItem(membership, principal.workspaceId),
    );
  }

  async getCurrentWorkspacePreferences(
    principal: AuthenticatedPrincipal,
  ): Promise<WorkspacePreferencesResponseDto> {
    const preference = await this.workspacesRepository.findWorkspacePreference(
      principal.workspaceId,
      principal.sub,
    );

    return this.toWorkspacePreferencesResponse(preference);
  }

  async updateCurrentWorkspacePreferences(
    principal: AuthenticatedPrincipal,
    dto: UpdateWorkspacePreferencesDto,
  ): Promise<WorkspacePreferencesResponseDto> {
    const updateData: WorkspacePreferenceUpdateData = {
      ...(dto.uiLocale !== undefined && { uiLocale: dto.uiLocale }),
      ...(dto.dateFormat !== undefined && { dateFormat: dto.dateFormat }),
      ...(dto.dashboardPreferences !== undefined && {
        dashboardPreferences:
          dto.dashboardPreferences as Prisma.InputJsonObject,
      }),
      ...(dto.reportPreferences !== undefined && {
        reportPreferences: dto.reportPreferences as Prisma.InputJsonObject,
      }),
      ...(dto.transactionPreferences !== undefined && {
        transactionPreferences:
          dto.transactionPreferences as Prisma.InputJsonObject,
      }),
    };

    if (Object.keys(updateData).length === 0) {
      return this.getCurrentWorkspacePreferences(principal);
    }

    const preference =
      await this.workspacesRepository.upsertWorkspacePreference(
        principal.workspaceId,
        principal.sub,
        updateData,
      );

    return this.toWorkspacePreferencesResponse(preference);
  }

  async updateCurrentWorkspace(
    principal: AuthenticatedPrincipal,
    dto: UpdateWorkspaceDto,
  ): Promise<CurrentWorkspaceResponseDto> {
    const hasWorkspaceChanges = dto.name !== undefined;

    if (!hasWorkspaceChanges) {
      return this.getCurrentWorkspace(principal);
    }

    const updatedWorkspace = await this.workspacesRepository.updateWorkspace(
      principal.workspaceId,
      {
        ...(dto.name !== undefined && { name: dto.name }),
      },
    );

    return this.toCurrentWorkspaceResponse(principal, updatedWorkspace);
  }

  async updateWorkspaceSettings(
    principal: AuthenticatedPrincipal,
    dto: UpdateWorkspaceSettingsDto,
  ): Promise<CurrentWorkspaceResponseDto> {
    const settingsUpdate = {
      ...(dto.baseCurrencyCode !== undefined && {
        baseCurrencyCode: dto.baseCurrencyCode,
      }),
      ...(dto.contentLocale !== undefined && {
        contentLocale: dto.contentLocale,
      }),
      ...(dto.dateFormat !== undefined && { dateFormat: dto.dateFormat }),
      ...(dto.monthStartDay !== undefined && {
        monthStartDay: dto.monthStartDay,
      }),
      ...(dto.weekStartDay !== undefined && {
        weekStartDay: dto.weekStartDay,
      }),
      ...(dto.financialTimezone !== undefined && {
        financialTimezone: dto.financialTimezone,
      }),
    };

    if (Object.keys(settingsUpdate).length === 0) {
      return this.getCurrentWorkspace(principal);
    }

    const updatedWorkspace = await this.workspacesRepository.updateSettings(
      principal.workspaceId,
      settingsUpdate,
    );

    return this.toCurrentWorkspaceResponse(principal, updatedWorkspace);
  }

  private async findWorkspaceOrThrow(
    workspaceId: string,
  ): Promise<WorkspaceWithSettings> {
    const workspace = await this.workspacesRepository.findById(workspaceId);

    if (!workspace) {
      throw new BusinessException(
        ERROR_CODES.RESOURCE_NOT_FOUND,
        'Workspace not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return workspace;
  }

  private toSettingsDto(
    workspace: WorkspaceWithSettings,
  ): WorkspaceSettingsDto {
    if (!workspace.settings) {
      throw new BusinessException(
        ERROR_CODES.RESOURCE_NOT_FOUND,
        'Workspace settings not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      baseCurrencyCode: workspace.settings.baseCurrencyCode,
      contentLocale: workspace.settings.contentLocale,
      dateFormat: workspace.settings.dateFormat,
      monthStartDay: workspace.settings.monthStartDay,
      weekStartDay: workspace.settings.weekStartDay,
      financialTimezone: workspace.settings.financialTimezone,
    };
  }

  private toCurrentWorkspaceResponse(
    principal: AuthenticatedPrincipal,
    workspace: WorkspaceWithSettings,
  ): CurrentWorkspaceResponseDto {
    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
        status: workspace.status,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
      membership: {
        id: principal.membership.id,
        role: principal.membership.role,
        status: principal.membership.status,
        joinedAt: principal.membership.joinedAt,
      },
      settings: this.toSettingsDto(workspace),
    };
  }

  private toWorkspaceDirectoryItem(
    membership: WorkspaceMembershipWithWorkspace,
    currentWorkspaceId: string,
  ): WorkspaceDirectoryItemDto {
    return {
      workspace: {
        id: membership.workspace.id,
        name: membership.workspace.name,
        type: membership.workspace.type,
        status: membership.workspace.status,
        createdAt: membership.workspace.createdAt,
        updatedAt: membership.workspace.updatedAt,
      },
      membership: {
        id: membership.id,
        role: membership.role,
        status: membership.status,
        joinedAt: membership.joinedAt,
      },
      isCurrent: membership.workspaceId === currentWorkspaceId,
    };
  }

  private toWorkspacePreferencesResponse(
    preference:
      | Awaited<ReturnType<WorkspacesRepository['findWorkspacePreference']>>
      | Awaited<ReturnType<WorkspacesRepository['upsertWorkspacePreference']>>,
  ): WorkspacePreferencesResponseDto {
    return {
      uiLocale: preference?.uiLocale ?? null,
      dateFormat: preference?.dateFormat ?? null,
      dashboardPreferences: this.toJsonObject(preference?.dashboardPreferences),
      reportPreferences: this.toJsonObject(preference?.reportPreferences),
      transactionPreferences: this.toJsonObject(
        preference?.transactionPreferences,
      ),
    };
  }

  private toJsonObject(
    value: Prisma.JsonValue | undefined,
  ): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
