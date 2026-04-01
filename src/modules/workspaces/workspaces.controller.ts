import { Body, Controller, Get, HttpStatus, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiPropertyOptional,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '@common/decorators/current-principal.decorator';
import { RequireWorkspaceRole } from '@common/decorators/workspace-role.decorator';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import { UpdateWorkspaceDto } from '@modules/workspaces/dtos/update-workspace.dto';
import { UpdateWorkspaceSettingsDto } from '@modules/workspaces/dtos/update-workspace-settings.dto';
import {
  CurrentWorkspaceResponseDto,
  WorkspaceSettingsResponseDto,
} from '@modules/workspaces/dtos/workspace-response.dto';
import { WorkspacesService } from '@modules/workspaces/workspaces.service';
import { WorkspaceRole } from '@/generated/prisma/client';

@ApiTags('Workspaces')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

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
