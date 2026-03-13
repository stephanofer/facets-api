import { ApiProperty } from '@nestjs/swagger';
import {
  WorkspaceMembershipStatus,
  WorkspaceRole,
  WorkspaceStatus,
  WorkspaceType,
} from '../../../generated/prisma/client';

export class WorkspaceSettingsDto {
  @ApiProperty({ example: 'USD' })
  baseCurrencyCode: string;

  @ApiProperty({ example: 'en' })
  baseLanguage: string;

  @ApiProperty({ example: 'DD/MM/YYYY' })
  dateFormat: string;

  @ApiProperty({ example: 1 })
  monthStartDay: number;

  @ApiProperty({ example: 1 })
  weekStartDay: number;

  @ApiProperty({ example: 'UTC' })
  timezone: string;

  @ApiProperty({ example: 'en-US' })
  locale: string;

  @ApiProperty({ example: 'John Workspace' })
  displayLabel: string;
}

export class WorkspaceSummaryDto {
  @ApiProperty({ example: 'cwksp_123456789' })
  id: string;

  @ApiProperty({ example: 'John Workspace' })
  name: string;

  @ApiProperty({ enum: WorkspaceType, example: WorkspaceType.PERSONAL })
  type: WorkspaceType;

  @ApiProperty({ enum: WorkspaceStatus, example: WorkspaceStatus.ACTIVE })
  status: WorkspaceStatus;

  @ApiProperty({ example: '2026-03-12T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-03-12T00:00:00.000Z' })
  updatedAt: Date;
}

export class WorkspaceMembershipSummaryDto {
  @ApiProperty({ example: 'cmship_123456789' })
  id: string;

  @ApiProperty({ enum: WorkspaceRole, example: WorkspaceRole.ADMIN })
  role: WorkspaceRole;

  @ApiProperty({
    enum: WorkspaceMembershipStatus,
    example: WorkspaceMembershipStatus.ACTIVE,
  })
  status: WorkspaceMembershipStatus;

  @ApiProperty({ example: '2026-03-12T00:00:00.000Z' })
  joinedAt: Date;
}

export class CurrentWorkspaceResponseDto {
  @ApiProperty({ type: WorkspaceSummaryDto })
  workspace: WorkspaceSummaryDto;

  @ApiProperty({ type: WorkspaceMembershipSummaryDto })
  membership: WorkspaceMembershipSummaryDto;

  @ApiProperty({ type: WorkspaceSettingsDto })
  settings: WorkspaceSettingsDto;
}

export class WorkspaceSettingsResponseDto {
  @ApiProperty({ type: WorkspaceSettingsDto })
  settings: WorkspaceSettingsDto;
}
