/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { BusinessException } from '@common/exceptions/business.exception';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import { WorkspacesRepository } from '@modules/workspaces/workspaces.repository';
import { WorkspacesService } from '@modules/workspaces/workspaces.service';
import {
  PlatformRole,
  UserStatus,
  WorkspaceMembershipStatus,
  WorkspaceRole,
  WorkspaceStatus,
  WorkspaceType,
} from '../../generated/prisma/client';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let repository: jest.Mocked<WorkspacesRepository>;

  const workspaceId = 'workspace-id';
  const membershipId = 'membership-id';
  const principal: AuthenticatedPrincipal = {
    sub: 'user-id',
    email: 'user@test.com',
    workspaceId,
    actorUserId: 'user-id',
    membershipId,
    workspaceRole: WorkspaceRole.ADMIN,
    platformRole: PlatformRole.USER,
    user: {
      id: 'user-id',
      email: 'user@test.com',
      password: 'hashed',
      firstName: 'Test',
      lastName: 'User',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: UserStatus.ACTIVE,
      platformRole: PlatformRole.USER,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    workspace: {
      id: workspaceId,
      name: 'Primary Workspace',
      slug: null,
      type: WorkspaceType.PERSONAL,
      status: WorkspaceStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    membership: {
      id: membershipId,
      workspaceId,
      userId: 'user-id',
      role: WorkspaceRole.ADMIN,
      status: WorkspaceMembershipStatus.ACTIVE,
      joinedAt: new Date('2026-03-12T00:00:00.000Z'),
      invitedByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const workspaceWithSettings = {
    id: workspaceId,
    name: 'Primary Workspace',
    slug: null,
    type: WorkspaceType.PERSONAL,
    status: WorkspaceStatus.ACTIVE,
    createdAt: new Date('2026-03-12T00:00:00.000Z'),
    updatedAt: new Date('2026-03-12T00:00:00.000Z'),
    settings: {
      id: 'settings-id',
      workspaceId,
      baseCurrencyCode: 'USD',
      baseLanguage: 'en',
      dateFormat: 'DD/MM/YYYY',
      monthStartDay: 1,
      weekStartDay: 1,
      timezone: 'UTC',
      locale: 'en-US',
      displayLabel: 'Primary Workspace',
      createdAt: new Date('2026-03-12T00:00:00.000Z'),
      updatedAt: new Date('2026-03-12T00:00:00.000Z'),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        {
          provide: WorkspacesRepository,
          useValue: {
            findById: jest.fn(),
            updateSettings: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(WorkspacesService);
    repository = module.get(WorkspacesRepository);
  });

  it('returns the current workspace summary with shared settings', async () => {
    repository.findById.mockResolvedValue(workspaceWithSettings);

    const result = await service.getCurrentWorkspace(principal);

    expect(repository.findById).toHaveBeenCalledWith(workspaceId);
    expect(result.workspace.id).toBe(workspaceId);
    expect(result.membership.role).toBe(WorkspaceRole.ADMIN);
    expect(result.settings.baseCurrencyCode).toBe('USD');
  });

  it('returns only shared settings for the current workspace surface', async () => {
    repository.findById.mockResolvedValue(workspaceWithSettings);

    const result = await service.getCurrentWorkspaceSettings(principal);

    expect(result.settings.displayLabel).toBe('Primary Workspace');
    expect(result.settings.timezone).toBe('UTC');
  });

  it('updates workspace type and shared settings without touching membership context', async () => {
    const updatedWorkspace = {
      ...workspaceWithSettings,
      type: WorkspaceType.FAMILY,
      settings: {
        ...workspaceWithSettings.settings,
        baseCurrencyCode: 'ARS',
        baseLanguage: 'es',
        dateFormat: 'YYYY-MM-DD',
        monthStartDay: 5,
        displayLabel: 'Casa',
      },
    };
    repository.updateSettings.mockResolvedValue(updatedWorkspace);

    const result = await service.updateWorkspaceSettings(principal, {
      workspaceType: WorkspaceType.FAMILY,
      baseCurrencyCode: 'ARS',
      baseLanguage: 'es',
      dateFormat: 'YYYY-MM-DD',
      monthStartDay: 5,
      displayLabel: 'Casa',
    });

    expect(repository.updateSettings).toHaveBeenCalledWith(workspaceId, {
      workspaceType: WorkspaceType.FAMILY,
      settings: expect.objectContaining({
        baseCurrencyCode: 'ARS',
        baseLanguage: 'es',
        dateFormat: 'YYYY-MM-DD',
        monthStartDay: 5,
        displayLabel: 'Casa',
      }),
    });
    expect(result.workspace.type).toBe(WorkspaceType.FAMILY);
    expect(result.membership.id).toBe(membershipId);
    expect(result.settings.displayLabel).toBe('Casa');
  });

  it('throws when the workspace cannot be found', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.getCurrentWorkspace(principal)).rejects.toThrow(
      BusinessException,
    );
  });
});
