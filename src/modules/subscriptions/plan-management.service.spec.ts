/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, Logger } from '@nestjs/common';
import { ERROR_CODES } from '@common/constants/app.constants';
import { BusinessException } from '@common/exceptions/business.exception';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import { MailService } from '@mail/mail.service';
import { PlanManagementService } from '@modules/subscriptions/plan-management.service';
import { PlanChangeLogRepository } from '@modules/subscriptions/repositories/plan-change-log.repository';
import { PlansRepository } from '@modules/subscriptions/repositories/plans.repository';
import { SubscriptionsRepository } from '@modules/subscriptions/repositories/subscriptions.repository';
import {
  FeatureLimitType,
  FeatureType,
  LimitPeriod,
  PlanChangeType,
  PlatformRole,
  SubscriptionStatus,
  UserStatus,
  WorkspaceMembershipStatus,
  WorkspaceRole,
  WorkspaceStatus,
  WorkspaceType,
} from '../../generated/prisma/client';

describe('PlanManagementService', () => {
  let service: PlanManagementService;
  let plansRepository: jest.Mocked<PlansRepository>;
  let subscriptionsRepository: jest.Mocked<SubscriptionsRepository>;
  let planChangeLogRepository: jest.Mocked<PlanChangeLogRepository>;
  let mailService: jest.Mocked<MailService>;

  const now = new Date('2026-03-12T12:00:00.000Z');
  const workspaceId = 'workspace-1';

  const currentPlan = {
    id: 'plan-free',
    code: 'free',
    name: 'Free',
    description: 'Free plan',
    isDefault: true,
    isActive: true,
    sortOrder: 0,
    priceMonthly: null,
    priceYearly: null,
    priceCurrency: 'USD',
    createdAt: now,
    updatedAt: now,
    planFeatures: [],
  };

  const targetPlan = {
    ...currentPlan,
    id: 'plan-pro',
    code: 'pro',
    name: 'Pro',
    isDefault: false,
    sortOrder: 1,
    priceMonthly: { toString: () => '9.99' },
    planFeatures: [
      {
        id: 'feature-pro-1',
        planId: 'plan-pro',
        featureCode: 'accounts',
        featureName: 'Accounts',
        featureDescription: null,
        featureType: FeatureType.RESOURCE,
        limitType: FeatureLimitType.COUNT,
        limitValue: 10,
        limitPeriod: LimitPeriod.MONTHLY,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };

  const subscription = {
    id: 'subscription-1',
    workspaceId,
    planId: currentPlan.id,
    status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: new Date('2026-03-01T00:00:00.000Z'),
    currentPeriodEnd: null,
    trialStart: null,
    trialEnd: null,
    scheduledPlanId: null,
    scheduledChangeAt: null,
    cancelledAt: null,
    cancelReason: null,
    graceOverages: null,
    gracePeriodEnd: null,
    createdAt: now,
    updatedAt: now,
    plan: currentPlan,
  };

  const adminPrincipal: AuthenticatedPrincipal = {
    sub: 'user-1',
    actorUserId: 'user-1',
    email: 'admin@facets.test',
    workspaceId,
    membershipId: 'membership-1',
    workspaceRole: WorkspaceRole.ADMIN,
    platformRole: PlatformRole.USER,
    user: {
      id: 'user-1',
      email: 'admin@facets.test',
      password: 'hashed',
      firstName: 'Ada',
      lastName: 'Admin',
      emailVerified: true,
      emailVerifiedAt: now,
      status: UserStatus.ACTIVE,
      platformRole: PlatformRole.USER,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    workspace: {
      id: workspaceId,
      name: 'Workspace 1',
      slug: null,
      type: WorkspaceType.PERSONAL,
      status: WorkspaceStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    },
    membership: {
      id: 'membership-1',
      workspaceId,
      userId: 'user-1',
      role: WorkspaceRole.ADMIN,
      status: WorkspaceMembershipStatus.ACTIVE,
      joinedAt: now,
      invitedByUserId: null,
      createdAt: now,
      updatedAt: now,
    },
  };

  const memberPrincipal: AuthenticatedPrincipal = {
    ...adminPrincipal,
    workspaceRole: WorkspaceRole.MEMBER,
    membership: {
      ...adminPrincipal.membership,
      role: WorkspaceRole.MEMBER,
    },
  };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanManagementService,
        {
          provide: PlansRepository,
          useValue: {
            findByCode: jest.fn(),
          },
        },
        {
          provide: SubscriptionsRepository,
          useValue: {
            findByWorkspaceId: jest.fn(),
            applyUpgrade: jest.fn(),
            findByWorkspaceIdWithScheduledPlan: jest.fn(),
            reactivate: jest.fn(),
            cancelScheduledChange: jest.fn(),
            scheduleDowngrade: jest.fn(),
            scheduleCancellation: jest.fn(),
          },
        },
        {
          provide: PlanChangeLogRepository,
          useValue: {
            create: jest.fn(),
            findByWorkspaceId: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendTemplate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(PlanManagementService);
    plansRepository = module.get(PlansRepository);
    subscriptionsRepository = module.get(SubscriptionsRepository);
    planChangeLogRepository = module.get(PlanChangeLogRepository);
    mailService = module.get(MailService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects non-admin principals from billing governance', async () => {
    await expect(
      service.previewPlanChange(memberPrincipal, 'pro'),
    ).rejects.toThrow(BusinessException);

    try {
      await service.previewPlanChange(memberPrincipal, 'pro');
    } catch (error) {
      const exception = error as BusinessException;
      expect(exception.code).toBe(ERROR_CODES.FORBIDDEN);
      expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
    }

    expect(subscriptionsRepository.findByWorkspaceId).not.toHaveBeenCalled();
  });

  it('records workspace-scoped upgrade history with the requesting actor', async () => {
    const upgradedSubscription = {
      ...subscription,
      planId: targetPlan.id,
      plan: targetPlan,
      currentPeriodEnd: new Date('2026-04-11T00:00:00.000Z'),
    };

    subscriptionsRepository.findByWorkspaceId.mockResolvedValue(
      subscription as never,
    );
    plansRepository.findByCode.mockResolvedValue(targetPlan as never);
    subscriptionsRepository.applyUpgrade.mockResolvedValue(
      upgradedSubscription as never,
    );
    planChangeLogRepository.create.mockResolvedValue({} as never);
    mailService.sendTemplate.mockResolvedValue(undefined as never);

    const result = await service.upgradePlan(adminPrincipal, targetPlan.code);

    expect(subscriptionsRepository.findByWorkspaceId).toHaveBeenCalledWith(
      workspaceId,
    );
    expect(subscriptionsRepository.applyUpgrade).toHaveBeenCalledWith(
      workspaceId,
      targetPlan.id,
      expect.any(Date),
    );
    expect(planChangeLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        requestedByUserId: adminPrincipal.user.id,
        fromPlanId: currentPlan.id,
        toPlanId: targetPlan.id,
        changeType: PlanChangeType.UPGRADE,
      }),
    );
    expect(mailService.sendTemplate).toHaveBeenCalledWith(
      'plan-upgraded',
      adminPrincipal.email,
      expect.objectContaining({ userName: adminPrincipal.user.firstName }),
    );
    expect(result.subscription.plan.code).toBe(targetPlan.code);
  });

  it('returns plan history only for the active workspace', async () => {
    const logs = [
      {
        id: 'log-1',
        workspaceId,
        requestedByUserId: adminPrincipal.user.id,
        fromPlanId: currentPlan.id,
        toPlanId: targetPlan.id,
        changeType: PlanChangeType.UPGRADE,
        requestedAt: now,
        effectiveAt: now,
        scheduledFor: null,
        prorationAmount: null,
        reason: null,
        metadata: {},
        createdAt: now,
        fromPlan: currentPlan,
        toPlan: targetPlan,
      },
    ];

    planChangeLogRepository.findByWorkspaceId.mockResolvedValue(logs as never);

    const result = await service.getPlanChangeHistory(adminPrincipal, 5);

    expect(planChangeLogRepository.findByWorkspaceId).toHaveBeenCalledWith(
      workspaceId,
      5,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      fromPlanCode: currentPlan.code,
      toPlanCode: targetPlan.code,
      changeType: PlanChangeType.UPGRADE,
    });
  });
});
