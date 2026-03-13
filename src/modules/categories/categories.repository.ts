import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import {
  Category,
  Prisma,
  TransactionType,
} from '../../generated/prisma/client';

export interface CategoryWithChildren extends Category {
  children: Category[];
}

export interface CategoryQueryFilters {
  workspaceId: string;
  type?: TransactionType;
  includeInactive?: boolean;
}

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a custom category for a workspace
   */
  async create(data: Prisma.CategoryUncheckedCreateInput): Promise<Category> {
    return this.prisma.category.create({ data });
  }

  /**
   * Find a category by ID within the current workspace visibility scope
   */
  async findById(
    id: string,
    workspaceId: string,
  ): Promise<CategoryWithChildren | null> {
    return this.prisma.category.findFirst({
      where: {
        id,
        OR: this.buildVisibilityOr(workspaceId),
      },
      include: {
        children: {
          where: {
            OR: this.buildVisibilityOr(workspaceId),
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });
  }

  /**
   * Find all categories visible to a workspace (system + custom) as a tree
   *
   * Returns parent categories with their children included.
   * System categories are always returned.
   * Custom categories are filtered by workspaceId.
   */
  async findAllVisible(
    filters: CategoryQueryFilters,
  ): Promise<CategoryWithChildren[]> {
    const where: Prisma.CategoryWhereInput = {
      parentId: null, // Only top-level parents
      OR: this.buildVisibilityOr(filters.workspaceId),
    };

    if (filters.type) {
      where.type = filters.type;
    }

    if (!filters.includeInactive) {
      where.isActive = true;
    }

    // Build children filter
    const childrenWhere: Prisma.CategoryWhereInput = {
      OR: this.buildVisibilityOr(filters.workspaceId),
    };

    if (!filters.includeInactive) {
      childrenWhere.isActive = true;
    }

    return this.prisma.category.findMany({
      where,
      include: {
        children: {
          where: childrenWhere,
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Find all categories flat (no tree) for a workspace
   */
  async findAllFlat(filters: CategoryQueryFilters): Promise<Category[]> {
    const where: Prisma.CategoryWhereInput = {
      OR: this.buildVisibilityOr(filters.workspaceId),
    };

    if (filters.type) {
      where.type = filters.type;
    }

    if (!filters.includeInactive) {
      where.isActive = true;
    }

    return this.prisma.category.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Update a category
   */
  async update(
    id: string,
    workspaceId: string,
    data: Prisma.CategoryUncheckedUpdateInput,
  ): Promise<Category> {
    const [, category] = await this.prisma.$transaction([
      this.prisma.category.updateMany({
        where: { id, workspaceId, isSystem: false },
        data,
      }),
      this.prisma.category.findFirstOrThrow({
        where: { id, workspaceId, isSystem: false },
      }),
    ]);

    return category;
  }

  /**
   * Delete a category
   */
  async delete(id: string, workspaceId: string): Promise<void> {
    await this.prisma.category.deleteMany({
      where: { id, workspaceId, isSystem: false },
    });
  }

  /**
   * Soft-disable a category (set isActive=false)
   */
  async setActive(
    id: string,
    workspaceId: string,
    isActive: boolean,
  ): Promise<Category> {
    const [, category] = await this.prisma.$transaction([
      this.prisma.category.updateMany({
        where: { id, workspaceId, isSystem: false },
        data: { isActive },
      }),
      this.prisma.category.findFirstOrThrow({
        where: { id, workspaceId, isSystem: false },
      }),
    ]);

    return category;
  }

  /**
   * Count custom (non-system) categories for a workspace
   * Used for RESOURCE feature limit checks
   */
  async countCustom(workspaceId: string): Promise<number> {
    return this.prisma.category.count({
      where: { workspaceId, isSystem: false },
    });
  }

  /**
   * Check if a category has transactions referencing it
   */
  async hasTransactions(id: string, workspaceId: string): Promise<boolean> {
    const count = await this.prisma.transaction.count({
      where: { categoryId: id, workspaceId },
    });
    return count > 0;
  }

  /**
   * Check if a custom category name already exists for workspace+type+parent
   */
  async nameExists(
    workspaceId: string,
    name: string,
    type: TransactionType,
    parentId: string | null,
    excludeId?: string,
  ): Promise<boolean> {
    const where: Prisma.CategoryWhereInput = {
      workspaceId,
      isSystem: false,
      name: { equals: name, mode: 'insensitive' },
      type,
      parentId: parentId ?? null,
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const count = await this.prisma.category.count({ where });
    return count > 0;
  }

  /**
   * Check if a category is a parent (has no parentId) and
   * if it itself has a parent (to enforce 2-level max)
   */
  async getParentDepth(parentId: string, workspaceId: string): Promise<number> {
    const parent = await this.prisma.category.findFirst({
      where: {
        id: parentId,
        OR: this.buildVisibilityOr(workspaceId),
      },
      select: { parentId: true },
    });

    if (!parent) return -1; // Not found
    if (parent.parentId) return 2; // Parent itself is a child → would be 3rd level
    return 1; // Parent is top-level → child would be 2nd level (OK)
  }

  private buildVisibilityOr(workspaceId: string): Prisma.CategoryWhereInput[] {
    return [{ isSystem: true }, { workspaceId }];
  }
}
