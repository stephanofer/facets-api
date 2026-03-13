/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@common/constants/app.constants';
import { BusinessException } from '@common/exceptions/business.exception';
import { FEATURES } from '@modules/subscriptions/constants/features.constant';
import { SubscriptionsService } from '@modules/subscriptions/subscriptions.service';
import { PlansRepository } from '@modules/subscriptions/repositories/plans.repository';
import { SubscriptionsRepository } from '@modules/subscriptions/repositories/subscriptions.repository';
import { UsageRepository } from '@modules/subscriptions/repositories/usage.repository';
import {
  FeatureLimitType,
  FeatureType,
  LimitPeriod,
  SubscriptionStatus,
} from '../../generated/prisma/client';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let plansRepository: jest.Mocked<PlansRepository>;
  let subscriptionsRepository: jest.Mocked<SubscriptionsRepository>;
  let usageRepository: jest.Mocked<UsageRepository>;

  const workspaceId = 'workspace-1';
  const otherWorkspaceId = 'workspace-2';

  const freePlan = {
    id: 'plan-free',
    code: 'free',
    name: 'Free',
    description: 'Default plan',
    isDefault: true,
    isActive: true,
    sortOrder: 0,
    priceMonthly: null,
    priceYearly: null,
    priceCurrency: 'USD',
    createdAt: new Date(),
    updatedAt: new Date(),
    planFeatures: [],
  };

  const countPlanFeature = {
    id: 'feature-1',
    planId: freePlan.id,
    featureCode: FEATURES.TRANSACTIONS_PER_MONTH,
    featureName: 'Transactions per month',
    featureDescription: null,
    featureType: FeatureType.CONSUMABLE,
    limitType: FeatureLimitType.COUNT,
    limitValue: 100,
    limitPeriod: LimitPeriod.MONTHLY,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: PlansRepository,
          useValue: {
            findAllActive: jest.fn(),
            findByCode: jest.fn(),
            findDefault: jest.fn(),
          },
        },
        {
          provide: SubscriptionsRepository,
          useValue: {
            create: jest.fn(),
            findByWorkspaceId: jest.fn(),
            getWorkspacePlanFeature: jest.fn(),
          },
        },
        {
          provide: UsageRepository,
          useValue: {
            incrementUsage: jest.fn(),
            decrementUsage: jest.fn(),
            getCurrentUsage: jest.fn(),
            getAllCurrentUsage: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(SubscriptionsService);
    plansRepository = module.get(PlansRepository);
    subscriptionsRepository = module.get(SubscriptionsRepository);
    usageRepository = module.get(UsageRepository);
  });

  it('creates the default free subscription for a workspace', async () => {
    const createdSubscription = {
      id: 'subscription-1',
      workspaceId,
      planId: freePlan.id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: null,
      trialStart: null,
      trialEnd: null,
      scheduledPlanId: null,
      scheduledChangeAt: null,
      cancelledAt: null,
      cancelReason: null,
      graceOverages: null,
      gracePeriodEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      plan: freePlan,
    };

    plansRepository.findDefault.mockResolvedValue(freePlan as never);
    subscriptionsRepository.create.mockResolvedValue(
      createdSubscription as never,
    );

    const result = await service.createSubscriptionForWorkspace(workspaceId);

    expect(plansRepository.findDefault).toHaveBeenCalled();
    expect(subscriptionsRepository.create).toHaveBeenCalledWith({
      workspaceId,
      planId: freePlan.id,
      currentPeriodEnd: null,
    });
    expect(result).toBe(createdSubscription);
  });

  it('isolates consumable feature usage per workspace', async () => {
    subscriptionsRepository.getWorkspacePlanFeature.mockImplementation(
      async (requestedWorkspaceId: string) => {
        if (requestedWorkspaceId === workspaceId) {
          return countPlanFeature as never;
        }

        return {
          ...countPlanFeature,
          limitValue: 5,
        } as never;
      },
    );

    usageRepository.getCurrentUsage.mockImplementation(
      async (requestedWorkspaceId: string) => {
        if (requestedWorkspaceId === workspaceId) {
          return 100;
        }

        return 2;
      },
    );

    const blockedWorkspace = await service.checkWorkspaceFeatureAccess(
      workspaceId,
      FEATURES.TRANSACTIONS_PER_MONTH,
    );
    const allowedWorkspace = await service.checkWorkspaceFeatureAccess(
      otherWorkspaceId,
      FEATURES.TRANSACTIONS_PER_MONTH,
    );

    expect(blockedWorkspace).toEqual({
      allowed: false,
      reason: 'FEATURE_LIMIT_EXCEEDED',
      current: 100,
      limit: 100,
    });
    expect(allowedWorkspace).toEqual({
      allowed: true,
      reason: undefined,
      current: 2,
      limit: 5,
    });
    expect(usageRepository.getCurrentUsage).toHaveBeenNthCalledWith(
      1,
      workspaceId,
      FEATURES.TRANSACTIONS_PER_MONTH,
      LimitPeriod.MONTHLY,
    );
    expect(usageRepository.getCurrentUsage).toHaveBeenNthCalledWith(
      2,
      otherWorkspaceId,
      FEATURES.TRANSACTIONS_PER_MONTH,
      LimitPeriod.MONTHLY,
    );
  });

  it('fails when a workspace has no active subscription', async () => {
    subscriptionsRepository.findByWorkspaceId.mockResolvedValue(null);

    await expect(service.getWorkspaceSubscription(workspaceId)).rejects.toThrow(
      BusinessException,
    );

    try {
      await service.getWorkspaceSubscription(workspaceId);
    } catch (error) {
      const exception = error as BusinessException;
      expect(exception.code).toBe(ERROR_CODES.RESOURCE_NOT_FOUND);
      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    }
  });
});
