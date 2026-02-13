import { Injectable, HttpStatus } from '@nestjs/common';
import {
  CategoriesRepository,
  CategoryWithChildren,
} from '@modules/categories/categories.repository';
import { SubscriptionsService } from '@modules/subscriptions/subscriptions.service';
import { CreateCategoryDto } from '@modules/categories/dtos/create-category.dto';
import { UpdateCategoryDto } from '@modules/categories/dtos/update-category.dto';
import { QueryCategoryDto } from '@modules/categories/dtos/query-category.dto';
import {
  CategoryResponseDto,
  CategoryWithChildrenDto,
  CategoryTreeResponseDto,
} from '@modules/categories/dtos/category-response.dto';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_CODES } from '@common/constants/app.constants';
import { FEATURES } from '@modules/subscriptions/constants/features.constant';
import { Category } from '../../generated/prisma/client';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Create a custom category
   *
   * Checks:
   * 1. Feature limit (custom_categories per plan)
   * 2. Parent exists and type matches (if parentId provided)
   * 3. Max 2-level depth
   * 4. No duplicate name for user+type+parent
   */
  async create(
    userId: string,
    dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    // Check feature limit
    const currentCount = await this.categoriesRepository.countCustom(userId);
    const access = await this.subscriptionsService.checkFeatureAccess(
      userId,
      FEATURES.CUSTOM_CATEGORIES,
      currentCount,
    );

    if (!access.allowed) {
      throw new BusinessException(
        ERROR_CODES.FEATURE_LIMIT_EXCEEDED,
        `You have reached your custom category limit (${access.current}/${access.limit}). Please upgrade your plan.`,
        HttpStatus.FORBIDDEN,
      );
    }

    // Validate parent if provided
    if (dto.parentId) {
      await this.validateParent(dto.parentId, dto.type, userId);
    }

    // Check duplicate name
    const nameExists = await this.categoriesRepository.nameExists(
      userId,
      dto.name,
      dto.type,
      dto.parentId ?? null,
    );
    if (nameExists) {
      throw new BusinessException(
        ERROR_CODES.CATEGORY_DUPLICATE_NAME,
        `A category '${dto.name}' already exists for this type${dto.parentId ? ' under this parent' : ''}`,
        HttpStatus.CONFLICT,
      );
    }

    const category = await this.categoriesRepository.create({
      userId,
      name: dto.name,
      type: dto.type,
      parentId: dto.parentId ?? null,
      icon: dto.icon,
      color: dto.color,
      sortOrder: dto.sortOrder ?? 0,
      isSystem: false,
      isActive: true,
    });

    return this.toResponseDto(category);
  }

  /**
   * Get all categories for a user (system + custom)
   *
   * Returns a tree structure by default, or flat list if requested.
   */
  async findAll(
    userId: string,
    query: QueryCategoryDto,
  ): Promise<CategoryTreeResponseDto> {
    if (query.flat) {
      const categories = await this.categoriesRepository.findAllFlat({
        userId,
        type: query.type,
        includeInactive: query.includeInactive ?? false,
      });

      return {
        categories: categories.map((c) => ({
          ...this.toResponseDto(c),
          children: [],
        })),
        total: categories.length,
      };
    }

    const tree = await this.categoriesRepository.findAllForUser({
      userId,
      type: query.type,
      includeInactive: query.includeInactive ?? false,
    });

    const totalCount = tree.reduce(
      (sum, parent) => sum + 1 + parent.children.length,
      0,
    );

    return {
      categories: tree.map((c) => this.toTreeDto(c)),
      total: totalCount,
    };
  }

  /**
   * Get a single category by ID
   */
  async findById(
    userId: string,
    categoryId: string,
  ): Promise<CategoryWithChildrenDto> {
    const category = await this.findCategoryOrThrow(categoryId);

    // Verify ownership: must be system OR owned by user
    this.verifyAccess(category, userId);

    return this.toTreeDto(category);
  }

  /**
   * Update a custom category
   *
   * System categories CANNOT be modified.
   */
  async update(
    userId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.findCategoryOrThrow(categoryId);

    // Cannot edit system categories
    if (category.isSystem) {
      throw new BusinessException(
        ERROR_CODES.CATEGORY_IS_SYSTEM,
        'System categories cannot be modified',
        HttpStatus.FORBIDDEN,
      );
    }

    // Verify ownership
    this.verifyOwnership(category, userId);

    // Check duplicate name (if name is being changed)
    if (dto.name && dto.name !== category.name) {
      const nameExists = await this.categoriesRepository.nameExists(
        userId,
        dto.name,
        category.type,
        category.parentId,
        categoryId,
      );
      if (nameExists) {
        throw new BusinessException(
          ERROR_CODES.CATEGORY_DUPLICATE_NAME,
          `A category '${dto.name}' already exists for this type`,
          HttpStatus.CONFLICT,
        );
      }
    }

    const updated = await this.categoriesRepository.update(categoryId, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.icon !== undefined && { icon: dto.icon }),
      ...(dto.color !== undefined && { color: dto.color }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
    });

    return this.toResponseDto(updated);
  }

  /**
   * Delete a custom category
   *
   * System categories CANNOT be deleted.
   * Categories with transactions can only be deactivated.
   */
  async delete(userId: string, categoryId: string): Promise<void> {
    const category = await this.findCategoryOrThrow(categoryId);

    if (category.isSystem) {
      throw new BusinessException(
        ERROR_CODES.CATEGORY_IS_SYSTEM,
        'System categories cannot be deleted',
        HttpStatus.FORBIDDEN,
      );
    }

    this.verifyOwnership(category, userId);

    const hasTransactions =
      await this.categoriesRepository.hasTransactions(categoryId);
    if (hasTransactions) {
      throw new BusinessException(
        ERROR_CODES.CATEGORY_HAS_TRANSACTIONS,
        'Cannot delete a category with transactions. Deactivate it instead.',
        HttpStatus.CONFLICT,
      );
    }

    await this.categoriesRepository.delete(categoryId);
  }

  /**
   * Deactivate a custom category (soft delete)
   */
  async deactivate(
    userId: string,
    categoryId: string,
  ): Promise<CategoryResponseDto> {
    const category = await this.findCategoryOrThrow(categoryId);

    if (category.isSystem) {
      throw new BusinessException(
        ERROR_CODES.CATEGORY_IS_SYSTEM,
        'System categories cannot be deactivated',
        HttpStatus.FORBIDDEN,
      );
    }

    this.verifyOwnership(category, userId);

    const updated = await this.categoriesRepository.setActive(
      categoryId,
      false,
    );
    return this.toResponseDto(updated);
  }

  /**
   * Reactivate a custom category
   */
  async reactivate(
    userId: string,
    categoryId: string,
  ): Promise<CategoryResponseDto> {
    const category = await this.findCategoryOrThrow(categoryId);

    if (category.isSystem) {
      throw new BusinessException(
        ERROR_CODES.CATEGORY_IS_SYSTEM,
        'System categories cannot be modified',
        HttpStatus.FORBIDDEN,
      );
    }

    this.verifyOwnership(category, userId);

    if (category.isActive) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION_ERROR,
        'Category is already active',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.categoriesRepository.setActive(categoryId, true);
    return this.toResponseDto(updated);
  }

  /**
   * Count custom categories for a user (used by FeatureGuard/SubscriptionsService)
   */
  async countCustom(userId: string): Promise<number> {
    return this.categoriesRepository.countCustom(userId);
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Find category or throw 404
   */
  private async findCategoryOrThrow(
    categoryId: string,
  ): Promise<CategoryWithChildren> {
    const category = await this.categoriesRepository.findById(categoryId);

    if (!category) {
      throw new BusinessException(
        ERROR_CODES.CATEGORY_NOT_FOUND,
        'Category not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return category;
  }

  /**
   * Verify user can VIEW a category (system or owned)
   */
  private verifyAccess(category: Category, userId: string): void {
    if (!category.isSystem && category.userId !== userId) {
      throw new BusinessException(
        ERROR_CODES.CATEGORY_NOT_FOUND,
        'Category not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Verify user OWNS a custom category
   */
  private verifyOwnership(category: Category, userId: string): void {
    if (category.userId !== userId) {
      throw new BusinessException(
        ERROR_CODES.CATEGORY_NOT_FOUND,
        'Category not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Validate parent category for subcategory creation
   */
  private async validateParent(
    parentId: string,
    childType: string,
    userId: string,
  ): Promise<void> {
    const parent = await this.categoriesRepository.findById(parentId);

    if (!parent) {
      throw new BusinessException(
        ERROR_CODES.CATEGORY_NOT_FOUND,
        'Parent category not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Parent must be accessible (system or owned by user)
    if (!parent.isSystem && parent.userId !== userId) {
      throw new BusinessException(
        ERROR_CODES.CATEGORY_NOT_FOUND,
        'Parent category not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Parent and child must have the same transaction type
    if (parent.type !== childType) {
      throw new BusinessException(
        ERROR_CODES.CATEGORY_PARENT_TYPE_MISMATCH,
        `Parent category type '${parent.type}' does not match child type '${childType}'`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Enforce 2-level max depth
    const depth = await this.categoriesRepository.getParentDepth(parentId);
    if (depth >= 2) {
      throw new BusinessException(
        ERROR_CODES.CATEGORY_MAX_DEPTH,
        'Categories support a maximum of 2 levels (parent → child). Cannot create a deeper subcategory.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Map Category entity to response DTO
   */
  private toResponseDto(category: Category): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      type: category.type,
      parentId: category.parentId ?? undefined,
      icon: category.icon ?? undefined,
      color: category.color ?? undefined,
      isSystem: category.isSystem,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  /**
   * Map Category with children to tree DTO
   */
  private toTreeDto(category: CategoryWithChildren): CategoryWithChildrenDto {
    return {
      ...this.toResponseDto(category),
      children: category.children.map((c) => this.toResponseDto(c)),
    };
  }
}
