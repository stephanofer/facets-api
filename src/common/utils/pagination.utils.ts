import { PaginationMeta } from '@common/interfaces/api-response.interface';

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Calculate pagination metadata
 */
export function calculatePagination(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Calculate skip value for Prisma pagination
 */
export function calculateSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}
