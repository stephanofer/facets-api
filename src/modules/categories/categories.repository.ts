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
  userId: string;
  type?: TransactionType;
  includeInactive?: boolean;
}

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a custom category for a user
   */
  async create(data: Prisma.CategoryUncheckedCreateInput): Promise<Category> {
    return this.prisma.category.create({ data });
  }

  /**
   * Find a category by ID
   * Can be a system category (userId=null) or a user's custom category
   */
  async findById(id: string): Promise<CategoryWithChildren | null> {
    return this.prisma.category.findUnique({
      where: { id },
      include: { children: true },
    });
  }

  /**
   * Find all categories visible to a user (system + custom) as a tree
   *
   * Returns parent categories with their children included.
   * System categories (userId=null) are always returned.
   * Custom categories are filtered by userId.
   */
  async findAllForUser(
    filters: CategoryQueryFilters,
  ): Promise<CategoryWithChildren[]> {
    const where: Prisma.CategoryWhereInput = {
      parentId: null, // Only top-level parents
      OR: [
        { isSystem: true }, // System categories visible to all
        { userId: filters.userId }, // User's custom categories
      ],
    };

    if (filters.type) {
      where.type = filters.type;
    }

    if (!filters.includeInactive) {
      where.isActive = true;
    }

    // Build children filter
    const childrenWhere: Prisma.CategoryWhereInput = {
      OR: [{ isSystem: true }, { userId: filters.userId }],
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
   * Find all categories flat (no tree) for a user
   */
  async findAllFlat(filters: CategoryQueryFilters): Promise<Category[]> {
    const where: Prisma.CategoryWhereInput = {
      OR: [{ isSystem: true }, { userId: filters.userId }],
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
    data: Prisma.CategoryUncheckedUpdateInput,
  ): Promise<Category> {
    return this.prisma.category.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a category
   */
  async delete(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { id } });
  }

  /**
   * Soft-disable a category (set isActive=false)
   */
  async setActive(id: string, isActive: boolean): Promise<Category> {
    return this.prisma.category.update({
      where: { id },
      data: { isActive },
    });
  }

  /**
   * Count custom (non-system) categories for a user
   * Used for RESOURCE feature limit checks
   */
  async countCustom(userId: string): Promise<number> {
    return this.prisma.category.count({
      where: { userId, isSystem: false },
    });
  }

  /**
   * Check if a category has transactions referencing it
   */
  async hasTransactions(id: string): Promise<boolean> {
    const count = await this.prisma.transaction.count({
      where: { categoryId: id },
    });
    return count > 0;
  }

  /**
   * Check if a custom category name already exists for user+type+parent
   * Respects the unique constraint: @@unique([userId, name, type, parentId])
   */
  async nameExists(
    userId: string,
    name: string,
    type: TransactionType,
    parentId: string | null,
    excludeId?: string,
  ): Promise<boolean> {
    const where: Prisma.CategoryWhereInput = {
      userId,
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
  async getParentDepth(parentId: string): Promise<number> {
    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
      select: { parentId: true },
    });

    if (!parent) return -1; // Not found
    if (parent.parentId) return 2; // Parent itself is a child → would be 3rd level
    return 1; // Parent is top-level → child would be 2nd level (OK)
  }
}
