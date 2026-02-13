/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from '@modules/categories/categories.service';
import { CategoriesRepository } from '@modules/categories/categories.repository';
import { SubscriptionsService } from '@modules/subscriptions/subscriptions.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_CODES } from '@common/constants/app.constants';
import { TransactionType } from '../../generated/prisma/client';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let categoriesRepository: jest.Mocked<CategoriesRepository>;
  let subscriptionsService: jest.Mocked<SubscriptionsService>;

  const userId = 'test-user-id';

  const mockSystemCategory = {
    id: 'system-cat-1',
    userId: null,
    parentId: null,
    name: 'Food & Drinks',
    type: TransactionType.EXPENSE,
    icon: 'utensils',
    color: '#FF6B6B',
    isSystem: true,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    children: [],
  };

  const mockCustomCategory = {
    id: 'custom-cat-1',
    userId,
    parentId: null,
    name: 'My Custom',
    type: TransactionType.EXPENSE,
    icon: 'star',
    color: '#123456',
    isSystem: false,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    children: [],
  };

  const mockSubcategory = {
    id: 'sub-cat-1',
    userId,
    parentId: mockCustomCategory.id,
    name: 'Sub Category',
    type: TransactionType.EXPENSE,
    icon: 'tag',
    color: '#654321',
    isSystem: false,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    children: [],
  };

  beforeEach(async () => {
    const mockCategoriesRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAllForUser: jest.fn(),
      findAllFlat: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      setActive: jest.fn(),
      countCustom: jest.fn(),
      hasTransactions: jest.fn(),
      nameExists: jest.fn(),
      getParentDepth: jest.fn(),
    };

    const mockSubscriptionsService = {
      checkFeatureAccess: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: CategoriesRepository, useValue: mockCategoriesRepository },
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    categoriesRepository = module.get(CategoriesRepository);
    subscriptionsService = module.get(SubscriptionsService);
  });

  describe('create', () => {
    const createDto = {
      name: 'My Custom',
      type: TransactionType.EXPENSE,
    };

    it('should create a top-level custom category', async () => {
      categoriesRepository.countCustom.mockResolvedValue(0);
      subscriptionsService.checkFeatureAccess.mockResolvedValue({
        allowed: true,
        current: 0,
        limit: 10,
      });
      categoriesRepository.nameExists.mockResolvedValue(false);
      categoriesRepository.create.mockResolvedValue(mockCustomCategory);

      const result = await service.create(userId, createDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('My Custom');
      expect(result.isSystem).toBe(false);
      expect(categoriesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          name: 'My Custom',
          type: TransactionType.EXPENSE,
          isSystem: false,
        }),
      );
    });

    it('should create a subcategory under a parent', async () => {
      categoriesRepository.countCustom.mockResolvedValue(0);
      subscriptionsService.checkFeatureAccess.mockResolvedValue({
        allowed: true,
        current: 0,
        limit: 10,
      });
      categoriesRepository.findById.mockResolvedValue({
        ...mockCustomCategory,
        children: [],
      });
      categoriesRepository.getParentDepth.mockResolvedValue(1);
      categoriesRepository.nameExists.mockResolvedValue(false);
      categoriesRepository.create.mockResolvedValue(mockSubcategory);

      const result = await service.create(userId, {
        ...createDto,
        name: 'Sub Category',
        parentId: mockCustomCategory.id,
      });

      expect(result.parentId).toBe(mockCustomCategory.id);
    });

    it('should throw when feature limit is exceeded', async () => {
      categoriesRepository.countCustom.mockResolvedValue(10);
      subscriptionsService.checkFeatureAccess.mockResolvedValue({
        allowed: false,
        current: 10,
        limit: 10,
        reason: 'FEATURE_LIMIT_EXCEEDED',
      });

      await expect(service.create(userId, createDto)).rejects.toMatchObject({
        code: ERROR_CODES.FEATURE_LIMIT_EXCEEDED,
      });
    });

    it('should throw on duplicate name', async () => {
      categoriesRepository.countCustom.mockResolvedValue(0);
      subscriptionsService.checkFeatureAccess.mockResolvedValue({
        allowed: true,
        current: 0,
        limit: 10,
      });
      categoriesRepository.nameExists.mockResolvedValue(true);

      await expect(service.create(userId, createDto)).rejects.toMatchObject({
        code: ERROR_CODES.CATEGORY_DUPLICATE_NAME,
      });
    });

    it('should throw when parent type does not match child type', async () => {
      categoriesRepository.countCustom.mockResolvedValue(0);
      subscriptionsService.checkFeatureAccess.mockResolvedValue({
        allowed: true,
        current: 0,
        limit: 10,
      });
      categoriesRepository.findById.mockResolvedValue({
        ...mockSystemCategory,
        type: TransactionType.INCOME,
        children: [],
      });

      await expect(
        service.create(userId, {
          ...createDto,
          parentId: mockSystemCategory.id,
          type: TransactionType.EXPENSE,
        }),
      ).rejects.toMatchObject({
        code: ERROR_CODES.CATEGORY_PARENT_TYPE_MISMATCH,
      });
    });

    it('should throw when exceeding 2-level depth', async () => {
      categoriesRepository.countCustom.mockResolvedValue(0);
      subscriptionsService.checkFeatureAccess.mockResolvedValue({
        allowed: true,
        current: 0,
        limit: 10,
      });
      categoriesRepository.findById.mockResolvedValue({
        ...mockSubcategory,
        children: [],
      });
      categoriesRepository.getParentDepth.mockResolvedValue(2);

      await expect(
        service.create(userId, {
          ...createDto,
          parentId: mockSubcategory.id,
        }),
      ).rejects.toMatchObject({ code: ERROR_CODES.CATEGORY_MAX_DEPTH });
    });

    it('should throw when parent not found', async () => {
      categoriesRepository.countCustom.mockResolvedValue(0);
      subscriptionsService.checkFeatureAccess.mockResolvedValue({
        allowed: true,
        current: 0,
        limit: 10,
      });
      categoriesRepository.findById.mockResolvedValue(null);

      await expect(
        service.create(userId, {
          ...createDto,
          parentId: 'non-existent-id',
        }),
      ).rejects.toMatchObject({ code: ERROR_CODES.CATEGORY_NOT_FOUND });
    });
  });

  describe('findAll', () => {
    it('should return categories as tree by default', async () => {
      categoriesRepository.findAllForUser.mockResolvedValue([
        { ...mockSystemCategory, children: [] },
        { ...mockCustomCategory, children: [mockSubcategory] },
      ]);

      const result = await service.findAll(userId, {});

      expect(result.categories).toHaveLength(2);
      expect(result.categories[1].children).toHaveLength(1);
      expect(result.total).toBe(3); // 2 parents + 1 child
    });

    it('should return flat list when requested', async () => {
      categoriesRepository.findAllFlat.mockResolvedValue([
        mockSystemCategory,
        mockCustomCategory,
        mockSubcategory,
      ]);

      const result = await service.findAll(userId, { flat: true });

      expect(result.categories).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should filter by type', async () => {
      categoriesRepository.findAllForUser.mockResolvedValue([]);

      await service.findAll(userId, { type: TransactionType.INCOME });

      expect(categoriesRepository.findAllForUser).toHaveBeenCalledWith(
        expect.objectContaining({ type: TransactionType.INCOME }),
      );
    });
  });

  describe('update', () => {
    it('should update a custom category', async () => {
      const updatedCategory = { ...mockCustomCategory, name: 'Updated Name' };
      categoriesRepository.findById.mockResolvedValue({
        ...mockCustomCategory,
        children: [],
      });
      categoriesRepository.nameExists.mockResolvedValue(false);
      categoriesRepository.update.mockResolvedValue(updatedCategory);

      const result = await service.update(userId, mockCustomCategory.id, {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should throw when trying to update a system category', async () => {
      categoriesRepository.findById.mockResolvedValue({
        ...mockSystemCategory,
        children: [],
      });

      await expect(
        service.update(userId, mockSystemCategory.id, { name: 'Hacked' }),
      ).rejects.toMatchObject({ code: ERROR_CODES.CATEGORY_IS_SYSTEM });
    });

    it('should throw on duplicate name during update', async () => {
      categoriesRepository.findById.mockResolvedValue({
        ...mockCustomCategory,
        children: [],
      });
      categoriesRepository.nameExists.mockResolvedValue(true);

      await expect(
        service.update(userId, mockCustomCategory.id, { name: 'Existing' }),
      ).rejects.toMatchObject({ code: ERROR_CODES.CATEGORY_DUPLICATE_NAME });
    });
  });

  describe('delete', () => {
    it('should delete a custom category with no transactions', async () => {
      categoriesRepository.findById.mockResolvedValue({
        ...mockCustomCategory,
        children: [],
      });
      categoriesRepository.hasTransactions.mockResolvedValue(false);

      await service.delete(userId, mockCustomCategory.id);

      expect(categoriesRepository.delete).toHaveBeenCalledWith(
        mockCustomCategory.id,
      );
    });

    it('should throw when deleting a system category', async () => {
      categoriesRepository.findById.mockResolvedValue({
        ...mockSystemCategory,
        children: [],
      });

      await expect(
        service.delete(userId, mockSystemCategory.id),
      ).rejects.toMatchObject({ code: ERROR_CODES.CATEGORY_IS_SYSTEM });
    });

    it('should throw when category has transactions', async () => {
      categoriesRepository.findById.mockResolvedValue({
        ...mockCustomCategory,
        children: [],
      });
      categoriesRepository.hasTransactions.mockResolvedValue(true);

      await expect(
        service.delete(userId, mockCustomCategory.id),
      ).rejects.toMatchObject({
        code: ERROR_CODES.CATEGORY_HAS_TRANSACTIONS,
      });
    });
  });

  describe('deactivate / reactivate', () => {
    it('should deactivate a custom category', async () => {
      categoriesRepository.findById.mockResolvedValue({
        ...mockCustomCategory,
        children: [],
      });
      categoriesRepository.setActive.mockResolvedValue({
        ...mockCustomCategory,
        isActive: false,
      });

      const result = await service.deactivate(userId, mockCustomCategory.id);
      expect(result.isActive).toBe(false);
    });

    it('should throw when deactivating a system category', async () => {
      categoriesRepository.findById.mockResolvedValue({
        ...mockSystemCategory,
        children: [],
      });

      await expect(
        service.deactivate(userId, mockSystemCategory.id),
      ).rejects.toMatchObject({ code: ERROR_CODES.CATEGORY_IS_SYSTEM });
    });

    it('should reactivate a deactivated custom category', async () => {
      categoriesRepository.findById.mockResolvedValue({
        ...mockCustomCategory,
        isActive: false,
        children: [],
      });
      categoriesRepository.setActive.mockResolvedValue({
        ...mockCustomCategory,
        isActive: true,
      });

      const result = await service.reactivate(userId, mockCustomCategory.id);
      expect(result.isActive).toBe(true);
    });

    it('should throw when reactivating an already active category', async () => {
      categoriesRepository.findById.mockResolvedValue({
        ...mockCustomCategory,
        isActive: true,
        children: [],
      });

      await expect(
        service.reactivate(userId, mockCustomCategory.id),
      ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_ERROR });
    });
  });
});
