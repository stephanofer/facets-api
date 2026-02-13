import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from '@modules/categories/dtos/create-category.dto';

/**
 * Update category DTO.
 *
 * `type` and `parentId` cannot be changed after creation:
 * - Changing type would break existing transactions referencing this category
 * - Moving a category to a different parent would be confusing UX
 */
export class UpdateCategoryDto extends PartialType(
  OmitType(CreateCategoryDto, ['type', 'parentId'] as const),
) {}
