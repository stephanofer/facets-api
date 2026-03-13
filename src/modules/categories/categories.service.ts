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
   * 4. No duplicate name for workspace+type+parent
   */
  async create(
    workspaceId: string,
    dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    // Check feature limit
    const currentCount =
      await this.categoriesRepository.countCustom(workspaceId);
    const access = await this.subscriptionsService.checkWorkspaceFeatureAccess(
      workspaceId,
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
      await this.validateParent(dto.parentId, dto.type, workspaceId);
    }

    // Check duplicate name
    const nameExists = await this.categoriesRepository.nameExists(
      workspaceId,
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
      workspaceId,
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
   * Get all categories for a workspace (system + custom)
   *
   * Returns a tree structure by default, or flat list if requested.
   */
  async findAll(
    workspaceId: string,
    query: QueryCategoryDto,
  ): Promise<CategoryTreeResponseDto> {
    if (query.flat) {
      const categories = await this.categoriesRepository.findAllFlat({
        workspaceId,
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

    const tree = await this.categoriesRepository.findAllVisible({
      workspaceId,
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
    workspaceId: string,
    categoryId: string,
  ): Promise<CategoryWithChildrenDto> {
    const category = await this.findCategoryOrThrow(categoryId, workspaceId);

    return this.toTreeDto(category);
  }

  /**
   * Update a custom category
   *
   * System categories CANNOT be modified.
   */
  async update(
    workspaceId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.findCategoryOrThrow(categoryId, workspaceId);

    // Cannot edit system categories
    if (category.isSystem) {
      throw new BusinessException(
        ERROR_CODES.CATEGORY_IS_SYSTEM,
        'System categories cannot be modified',
        HttpStatus.FORBIDDEN,
      );
    }

    // Verify ownership
    this.verifyOwnership(category, workspaceId);

    // Check duplicate name (if name is being changed)
    if (dto.name && dto.name !== category.name) {
      const nameExists = await this.categoriesRepository.nameExists(
        workspaceId,
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

    const updated = await this.categoriesRepository.update(
      categoryId,
      workspaceId,
      {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    );

    return this.toResponseDto(updated);
  }

  /**
   * Delete a custom category
   *
   * System categories CANNOT be deleted.
   * Categories with transactions can only be deactivated.
   */
  async delete(workspaceId: string, categoryId: string): Promise<void> {
    const category = await this.findCategoryOrThrow(categoryId, workspaceId);

    if (category.isSystem) {
      throw new BusinessException(
        ERROR_CODES.CATEGORY_IS_SYSTEM,
        'System categories cannot be deleted',
        HttpStatus.FORBIDDEN,
      );
    }

    this.verifyOwnership(category, workspaceId);

    const hasTransactions = await this.categoriesRepository.hasTransactions(
      categoryId,
      workspaceId,
    );
    if (hasTransactions) {
      throw new BusinessException(
        ERROR_CODES.CATEGORY_HAS_TRANSACTIONS,
        'Cannot delete a category with transactions. Deactivate it instead.',
        HttpStatus.CONFLICT,
      );
    }

    await this.categoriesRepository.delete(categoryId, workspaceId);
  }

  /**
   * Deactivate a custom category (soft delete)
   */
  async deactivate(
    workspaceId: string,
    categoryId: string,
  ): Promise<CategoryResponseDto> {
    const category = await this.findCategoryOrThrow(categoryId, workspaceId);

    if (category.isSystem) {
      throw new BusinessException(
        ERROR_CODES.CATEGORY_IS_SYSTEM,
        'System categories cannot be deactivated',
        HttpStatus.FORBIDDEN,
      );
    }

    this.verifyOwnership(category, workspaceId);

    const updated = await this.categoriesRepository.setActive(
      categoryId,
      workspaceId,
      false,
    );
    return this.toResponseDto(updated);
  }

  /**
   * Reactivate a custom category
   */
  async reactivate(
    workspaceId: string,
    categoryId: string,
  ): Promise<CategoryResponseDto> {
    const category = await this.findCategoryOrThrow(categoryId, workspaceId);

    if (category.isSystem) {
      throw new BusinessException(
        ERROR_CODES.CATEGORY_IS_SYSTEM,
        'System categories cannot be modified',
        HttpStatus.FORBIDDEN,
      );
    }

    this.verifyOwnership(category, workspaceId);

    if (category.isActive) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION_ERROR,
        'Category is already active',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.categoriesRepository.setActive(
      categoryId,
      workspaceId,
      true,
    );
    return this.toResponseDto(updated);
  }

  /**
   * Count custom categories for a workspace (used by FeatureGuard/SubscriptionsService)
   */
  async countCustom(workspaceId: string): Promise<number> {
    return this.categoriesRepository.countCustom(workspaceId);
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Find category or throw 404
   */
  private async findCategoryOrThrow(
    categoryId: string,
    workspaceId: string,
  ): Promise<CategoryWithChildren> {
    const category = await this.categoriesRepository.findById(
      categoryId,
      workspaceId,
    );

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
   * Verify workspace OWNS a custom category
   */
  private verifyOwnership(category: Category, workspaceId: string): void {
    if (category.workspaceId !== workspaceId) {
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
    workspaceId: string,
  ): Promise<void> {
    const parent = await this.categoriesRepository.findById(
      parentId,
      workspaceId,
    );

    if (!parent) {
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
    const depth = await this.categoriesRepository.getParentDepth(
      parentId,
      workspaceId,
    );
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
