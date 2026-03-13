import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@common/constants/app.constants';
import { BusinessException } from '@common/exceptions/business.exception';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import { UpdateWorkspaceSettingsDto } from '@modules/workspaces/dtos/update-workspace-settings.dto';
import {
  CurrentWorkspaceResponseDto,
  WorkspaceSettingsDto,
  WorkspaceSettingsResponseDto,
} from '@modules/workspaces/dtos/workspace-response.dto';
import {
  WorkspacesRepository,
  WorkspaceWithSettings,
} from '@modules/workspaces/workspaces.repository';

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

  async updateWorkspaceSettings(
    principal: AuthenticatedPrincipal,
    dto: UpdateWorkspaceSettingsDto,
  ): Promise<CurrentWorkspaceResponseDto> {
    const updatedWorkspace = await this.workspacesRepository.updateSettings(
      principal.workspaceId,
      {
        workspaceType: dto.workspaceType,
        settings: {
          ...(dto.baseCurrencyCode !== undefined && {
            baseCurrencyCode: dto.baseCurrencyCode,
          }),
          ...(dto.baseLanguage !== undefined && {
            baseLanguage: dto.baseLanguage,
          }),
          ...(dto.dateFormat !== undefined && { dateFormat: dto.dateFormat }),
          ...(dto.monthStartDay !== undefined && {
            monthStartDay: dto.monthStartDay,
          }),
          ...(dto.weekStartDay !== undefined && {
            weekStartDay: dto.weekStartDay,
          }),
          ...(dto.timezone !== undefined && { timezone: dto.timezone }),
          ...(dto.locale !== undefined && { locale: dto.locale }),
          ...(dto.displayLabel !== undefined && {
            displayLabel: dto.displayLabel,
          }),
        },
      },
    );

    return {
      workspace: {
        id: updatedWorkspace.id,
        name: updatedWorkspace.name,
        type: updatedWorkspace.type,
        status: updatedWorkspace.status,
        createdAt: updatedWorkspace.createdAt,
        updatedAt: updatedWorkspace.updatedAt,
      },
      membership: {
        id: principal.membership.id,
        role: principal.membership.role,
        status: principal.membership.status,
        joinedAt: principal.membership.joinedAt,
      },
      settings: this.toSettingsDto(updatedWorkspace),
    };
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
      baseLanguage: workspace.settings.baseLanguage,
      dateFormat: workspace.settings.dateFormat,
      monthStartDay: workspace.settings.monthStartDay,
      weekStartDay: workspace.settings.weekStartDay,
      timezone: workspace.settings.timezone,
      locale: workspace.settings.locale,
      displayLabel: workspace.settings.displayLabel,
    };
  }
}
