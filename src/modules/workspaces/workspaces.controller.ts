import { Body, Controller, Get, HttpStatus, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '@common/decorators/current-principal.decorator';
import { RequireWorkspaceRole } from '@common/decorators/workspace-role.decorator';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import { UpdateWorkspaceDto } from '@modules/workspaces/dtos/update-workspace.dto';
import { UpdateWorkspacePreferencesDto } from '@modules/workspaces/dtos/update-workspace-preferences.dto';
import { UpdateWorkspaceSettingsDto } from '@modules/workspaces/dtos/update-workspace-settings.dto';
import {
  CurrentWorkspaceResponseDto,
  WorkspaceDirectoryItemDto,
  WorkspaceSettingsResponseDto,
} from '@modules/workspaces/dtos/workspace-response.dto';
import { WorkspacePreferencesResponseDto } from '@modules/workspaces/dtos/workspace-preferences-response.dto';
import { WorkspacesService } from '@modules/workspaces/workspaces.service';
import { WorkspaceRole } from '@/generated/prisma/client';

@ApiTags('Workspaces')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  @RequireWorkspaceRole(
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.GUEST,
  )
  @ApiOperation({
    summary: 'List accessible workspaces',
    description:
      'Return only workspaces where the authenticated caller has active membership access. Each item includes workspace summary, membership summary, and whether it matches the current workspace from principal context.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Accessible workspaces for the authenticated caller',
    type: WorkspaceDirectoryItemDto,
    isArray: true,
  })
  async listWorkspaces(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<WorkspaceDirectoryItemDto[]> {
    return this.workspacesService.listWorkspaces(principal);
  }

  @Get('current')
  @RequireWorkspaceRole(
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.GUEST,
  )
  @ApiOperation({
    summary: 'Get current workspace',
    description:
      'Return the active workspace summary, membership context, and shared workspace settings. This route is intentionally workspace-scoped and does NOT expose personal user preferences.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current workspace summary and shared settings',
    type: CurrentWorkspaceResponseDto,
  })
  async getCurrentWorkspace(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<CurrentWorkspaceResponseDto> {
    return this.workspacesService.getCurrentWorkspace(principal);
  }

  @Patch('current')
  @RequireWorkspaceRole(WorkspaceRole.ADMIN)
  @ApiOperation({
    summary: 'Update current workspace',
    description:
      'Update workspace identity fields for the active workspace, such as the visible name. Only workspace admins can mutate this surface.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Workspace updated successfully',
    type: CurrentWorkspaceResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only workspace admins can update the workspace',
  })
  async updateCurrentWorkspace(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<CurrentWorkspaceResponseDto> {
    return this.workspacesService.updateCurrentWorkspace(principal, dto);
  }

  @Get('current/settings')
  @RequireWorkspaceRole(
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.GUEST,
  )
  @ApiOperation({
    summary: 'Get current workspace settings',
    description:
      'Return only shared workspace settings for the active workspace. Personal preferences remain user-scoped in UserPreference and are NOT read or mutated by this surface.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current shared workspace settings',
    type: WorkspaceSettingsResponseDto,
  })
  async getCurrentWorkspaceSettings(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<WorkspaceSettingsResponseDto> {
    return this.workspacesService.getCurrentWorkspaceSettings(principal);
  }

  @Get('current/preferences')
  @RequireWorkspaceRole(
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.GUEST,
  )
  @ApiOperation({
    summary: 'Get current workspace personal preferences',
    description:
      'Return only the current user preference overrides for the active workspace. Shared workspace settings and theme ownership are intentionally excluded from this surface.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current user preference overrides for the active workspace',
    type: WorkspacePreferencesResponseDto,
  })
  async getCurrentWorkspacePreferences(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<WorkspacePreferencesResponseDto> {
    return this.workspacesService.getCurrentWorkspacePreferences(principal);
  }

  @Patch('current/preferences')
  @RequireWorkspaceRole(
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.GUEST,
  )
  @ApiOperation({
    summary: 'Update current workspace personal preferences',
    description:
      'Update only per-user-per-workspace preference overrides for the active workspace. Shared workspace settings and theme are not owned by this route and cannot be mutated here.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current workspace personal preferences updated successfully',
    type: WorkspacePreferencesResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid workspace preference payload',
  })
  async updateCurrentWorkspacePreferences(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpdateWorkspacePreferencesDto,
  ): Promise<WorkspacePreferencesResponseDto> {
    return this.workspacesService.updateCurrentWorkspacePreferences(
      principal,
      dto,
    );
  }

  @Patch('current/settings')
  @RequireWorkspaceRole(WorkspaceRole.ADMIN)
  @ApiOperation({
    summary: 'Update current workspace settings',
    description:
      'Update shared workspace settings for the active workspace. Only workspace admins can mutate this surface. Workspace identity fields like name belong to PATCH /workspaces/current, not here.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Workspace settings updated successfully',
    type: CurrentWorkspaceResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only workspace admins can update shared workspace settings',
  })
  async updateCurrentWorkspaceSettings(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpdateWorkspaceSettingsDto,
  ): Promise<CurrentWorkspaceResponseDto> {
    return this.workspacesService.updateWorkspaceSettings(principal, dto);
  }
}
