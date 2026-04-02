/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { BusinessException } from '@common/exceptions/business.exception';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import { WorkspacesRepository } from '@modules/workspaces/workspaces.repository';
import { WorkspacesService } from '@modules/workspaces/workspaces.service';
import {
  WorkspaceMembershipStatus,
  PlatformRole,
  UserStatus,
  WorkspaceRole,
  WorkspaceStatus,
  WorkspaceType,
} from '@/generated/prisma/client';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let moduleRef: TestingModule;
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
      type: WorkspaceType.PERSONAL,
      status: WorkspaceStatus.ACTIVE,
      financialDataUpdatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    membership: {
      id: membershipId,
      workspaceId,
      userId: 'user-id',
      role: WorkspaceRole.ADMIN,
      status: WorkspaceMembershipStatus.ACTIVE,
      invitedAt: null,
      joinedAt: new Date('2026-03-12T00:00:00.000Z'),
      invitedByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const workspaceWithSettings = {
    id: workspaceId,
    name: 'Primary Workspace',
    type: WorkspaceType.PERSONAL,
    status: WorkspaceStatus.ACTIVE,
    financialDataUpdatedAt: new Date('2026-03-12T00:00:00.000Z'),
    createdAt: new Date('2026-03-12T00:00:00.000Z'),
    updatedAt: new Date('2026-03-12T00:00:00.000Z'),
    settings: {
      id: 'settings-id',
      workspaceId,
      baseCurrencyCode: 'USD',
      contentLocale: 'en-US',
      dateFormat: 'DD/MM/YYYY',
      monthStartDay: 1,
      weekStartDay: 1,
      financialTimezone: 'UTC',
      createdAt: new Date('2026-03-12T00:00:00.000Z'),
      updatedAt: new Date('2026-03-12T00:00:00.000Z'),
    },
  };

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        {
          provide: WorkspacesRepository,
          useValue: {
            findById: jest.fn(),
            findAccessibleWorkspaces: jest.fn(),
            findWorkspacePreference: jest.fn(),
            upsertWorkspacePreference: jest.fn(),
            updateWorkspace: jest.fn(),
            updateSettings: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(WorkspacesService);
    repository = moduleRef.get(WorkspacesRepository);
  });

  afterEach(async () => {
    await moduleRef.close();
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

    expect(result.settings.baseCurrencyCode).toBe('USD');
    expect(result.settings.financialTimezone).toBe('UTC');
  });

  it('updates workspace identity without touching shared settings', async () => {
    const updatedWorkspace = {
      ...workspaceWithSettings,
      name: 'Casa',
    };
    repository.updateWorkspace.mockResolvedValue(updatedWorkspace);

    const result = await service.updateCurrentWorkspace(principal, {
      name: 'Casa',
    });

    expect(repository.updateWorkspace).toHaveBeenCalledWith(workspaceId, {
      name: 'Casa',
    });
    expect(result.workspace.name).toBe('Casa');
    expect(result.membership.id).toBe(membershipId);
    expect(result.settings.baseCurrencyCode).toBe('USD');
  });

  it('updates shared settings without mutating workspace identity', async () => {
    const updatedWorkspace = {
      ...workspaceWithSettings,
      settings: {
        ...workspaceWithSettings.settings,
        baseCurrencyCode: 'ARS',
        contentLocale: 'es-AR',
        dateFormat: 'YYYY-MM-DD',
        monthStartDay: 5,
        financialTimezone: 'America/Argentina/Buenos_Aires',
      },
    };
    repository.updateSettings.mockResolvedValue(updatedWorkspace);

    const result = await service.updateWorkspaceSettings(principal, {
      baseCurrencyCode: 'ARS',
      contentLocale: 'es-AR',
      dateFormat: 'YYYY-MM-DD',
      monthStartDay: 5,
      financialTimezone: 'America/Argentina/Buenos_Aires',
    });

    expect(repository.updateSettings).toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({
        baseCurrencyCode: 'ARS',
        contentLocale: 'es-AR',
        dateFormat: 'YYYY-MM-DD',
        monthStartDay: 5,
        financialTimezone: 'America/Argentina/Buenos_Aires',
      }),
    );
    expect(result.workspace.type).toBe(WorkspaceType.PERSONAL);
    expect(result.workspace.name).toBe('Primary Workspace');
    expect(result.membership.id).toBe(membershipId);
    expect(result.settings.baseCurrencyCode).toBe('ARS');
  });

  it('throws when the workspace cannot be found', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.getCurrentWorkspace(principal)).rejects.toThrow(
      BusinessException,
    );
  });

  it('lists only accessible workspaces and marks the current one', async () => {
    repository.findAccessibleWorkspaces.mockResolvedValue([
      {
        id: membershipId,
        workspaceId,
        userId: principal.sub,
        role: WorkspaceRole.ADMIN,
        status: WorkspaceMembershipStatus.ACTIVE,
        invitedAt: null,
        joinedAt: new Date('2026-03-12T00:00:00.000Z'),
        invitedByUserId: null,
        createdAt: new Date('2026-03-12T00:00:00.000Z'),
        updatedAt: new Date('2026-03-12T00:00:00.000Z'),
        workspace: {
          id: workspaceId,
          name: 'Primary Workspace',
          type: WorkspaceType.PERSONAL,
          status: WorkspaceStatus.ACTIVE,
          financialDataUpdatedAt: new Date('2026-03-12T00:00:00.000Z'),
          createdAt: new Date('2026-03-12T00:00:00.000Z'),
          updatedAt: new Date('2026-03-12T00:00:00.000Z'),
        },
      },
      {
        id: 'membership-secondary',
        workspaceId: 'workspace-secondary',
        userId: principal.sub,
        role: WorkspaceRole.MEMBER,
        status: WorkspaceMembershipStatus.ACTIVE,
        invitedAt: null,
        joinedAt: new Date('2026-03-14T00:00:00.000Z'),
        invitedByUserId: null,
        createdAt: new Date('2026-03-14T00:00:00.000Z'),
        updatedAt: new Date('2026-03-14T00:00:00.000Z'),
        workspace: {
          id: 'workspace-secondary',
          name: 'Shared Space',
          type: WorkspaceType.GROUP,
          status: WorkspaceStatus.ACTIVE,
          financialDataUpdatedAt: new Date('2026-03-14T00:00:00.000Z'),
          createdAt: new Date('2026-03-14T00:00:00.000Z'),
          updatedAt: new Date('2026-03-14T00:00:00.000Z'),
        },
      },
    ] as never);

    const result = await service.listWorkspaces(principal);

    expect(repository.findAccessibleWorkspaces).toHaveBeenCalledWith(
      principal.sub,
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      isCurrent: true,
      workspace: { id: workspaceId, name: 'Primary Workspace' },
      membership: { id: membershipId, role: WorkspaceRole.ADMIN },
    });
    expect(result[1]).toMatchObject({
      isCurrent: false,
      workspace: { id: 'workspace-secondary', name: 'Shared Space' },
      membership: { role: WorkspaceRole.MEMBER },
    });
  });

  it('returns a stable empty current workspace preference shape when no row exists', async () => {
    repository.findWorkspacePreference.mockResolvedValue(null);

    const result = await service.getCurrentWorkspacePreferences(principal);

    expect(repository.findWorkspacePreference).toHaveBeenCalledWith(
      workspaceId,
      principal.sub,
    );
    expect(result).toEqual({
      uiLocale: null,
      dateFormat: null,
      dashboardPreferences: {},
      reportPreferences: {},
      transactionPreferences: {},
    });
  });

  it('updates only current user preferences for the current workspace', async () => {
    repository.upsertWorkspacePreference.mockResolvedValue({
      id: 'pref-id',
      workspaceId,
      userId: principal.sub,
      uiLocale: 'es-AR',
      dateFormat: 'YYYY-MM-DD',
      dashboardPreferences: { compact: true },
      reportPreferences: { defaultPeriod: 'month' },
      transactionPreferences: { showPending: true },
      createdAt: new Date('2026-03-12T00:00:00.000Z'),
      updatedAt: new Date('2026-03-12T00:00:00.000Z'),
    } as never);

    const result = await service.updateCurrentWorkspacePreferences(principal, {
      uiLocale: 'es-AR',
      dateFormat: 'YYYY-MM-DD',
      dashboardPreferences: { compact: true },
      reportPreferences: { defaultPeriod: 'month' },
      transactionPreferences: { showPending: true },
    });

    expect(repository.upsertWorkspacePreference).toHaveBeenCalledWith(
      workspaceId,
      principal.sub,
      {
        uiLocale: 'es-AR',
        dateFormat: 'YYYY-MM-DD',
        dashboardPreferences: { compact: true },
        reportPreferences: { defaultPeriod: 'month' },
        transactionPreferences: { showPending: true },
      },
    );
    expect(result).toEqual({
      uiLocale: 'es-AR',
      dateFormat: 'YYYY-MM-DD',
      dashboardPreferences: { compact: true },
      reportPreferences: { defaultPeriod: 'month' },
      transactionPreferences: { showPending: true },
    });
  });
});
