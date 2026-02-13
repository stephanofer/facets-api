import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '../../../generated/prisma/client';

export class CategoryResponseDto {
  @ApiProperty({ example: 'cm3xk7z9w0001jn08abc12345' })
  id: string;

  @ApiProperty({ example: 'Food & Drinks' })
  name: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  type: TransactionType;

  @ApiPropertyOptional({ example: 'cm3xk7z9w0001jn08abc12345' })
  parentId?: string;

  @ApiPropertyOptional({ example: 'utensils' })
  icon?: string;

  @ApiPropertyOptional({ example: '#FF6B6B' })
  color?: string;

  @ApiProperty({
    example: false,
    description: 'System categories cannot be edited or deleted',
  })
  isSystem: boolean;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 0 })
  sortOrder: number;

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  updatedAt: Date;
}

export class CategoryWithChildrenDto extends CategoryResponseDto {
  @ApiProperty({
    type: [CategoryResponseDto],
    description: 'Subcategories (second level)',
  })
  children: CategoryResponseDto[];
}

export class CategoryTreeResponseDto {
  @ApiProperty({ type: [CategoryWithChildrenDto] })
  categories: CategoryWithChildrenDto[];

  @ApiProperty({
    example: 15,
    description: 'Total number of categories (including children)',
  })
  total: number;
}
