import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CategoriesService } from '@modules/categories/categories.service';
import { CreateCategoryDto } from '@modules/categories/dtos/create-category.dto';
import { UpdateCategoryDto } from '@modules/categories/dtos/update-category.dto';
import { QueryCategoryDto } from '@modules/categories/dtos/query-category.dto';
import {
  CategoryResponseDto,
  CategoryWithChildrenDto,
  CategoryTreeResponseDto,
} from '@modules/categories/dtos/category-response.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { RequireFeature } from '@common/decorators/feature.decorator';
import { FeatureGuard } from '@common/guards/feature.guard';
import { ParseCuidPipe } from '@common/pipes/parse-cuid.pipe';
import { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';
import { FEATURES } from '@modules/subscriptions/constants/features.constant';

@ApiTags('Categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * Create a custom category
   */
  @Post()
  @UseGuards(FeatureGuard)
  @RequireFeature(FEATURES.CUSTOM_CATEGORIES)
  @ApiOperation({
    summary: 'Create custom category',
    description:
      'Create a custom transaction category. Subject to plan limits. Supports 2-level hierarchy (parent → child).',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Category created successfully',
    type: CategoryResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Category name already exists',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Category limit reached or system category modification',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Validation error, max depth exceeded, or parent type mismatch',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.create(user.sub, dto);
  }

  /**
   * List all categories (system + custom)
   */
  @Get()
  @ApiOperation({
    summary: 'List categories',
    description:
      'Get all categories for the authenticated user. Includes system categories (shared) and custom categories (personal). Returns tree structure by default.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Category tree (or flat list if ?flat=true)',
    type: CategoryTreeResponseDto,
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryCategoryDto,
  ): Promise<CategoryTreeResponseDto> {
    return this.categoriesService.findAll(user.sub, query);
  }

  /**
   * Get a single category with its children
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get category',
    description:
      'Get details of a specific category including its subcategories.',
  })
  @ApiParam({ name: 'id', description: 'Category ID (CUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Category details with children',
    type: CategoryWithChildrenDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category not found',
  })
  async findById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ): Promise<CategoryWithChildrenDto> {
    return this.categoriesService.findById(user.sub, id);
  }

  /**
   * Update a custom category
   */
  @Put(':id')
  @ApiOperation({
    summary: 'Update category',
    description:
      'Update a custom category. System categories cannot be modified. Type and parent cannot be changed.',
  })
  @ApiParam({ name: 'id', description: 'Category ID (CUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Category updated successfully',
    type: CategoryResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Cannot modify system categories',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Category name already exists',
  })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.update(user.sub, id, dto);
  }

  /**
   * Delete a custom category
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete category',
    description:
      'Permanently delete a custom category. System categories cannot be deleted. Categories with transactions can only be deactivated.',
  })
  @ApiParam({ name: 'id', description: 'Category ID (CUID)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Category deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Cannot delete system categories',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Category has transactions, deactivate instead',
  })
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ): Promise<void> {
    return this.categoriesService.delete(user.sub, id);
  }

  /**
   * Deactivate a custom category (soft delete)
   */
  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Deactivate category',
    description:
      'Deactivate a custom category to hide it from selection lists while preserving existing transaction references.',
  })
  @ApiParam({ name: 'id', description: 'Category ID (CUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Category deactivated successfully',
    type: CategoryResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Cannot deactivate system categories',
  })
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.deactivate(user.sub, id);
  }

  /**
   * Reactivate a custom category
   */
  @Patch(':id/reactivate')
  @ApiOperation({
    summary: 'Reactivate category',
    description: 'Reactivate a previously deactivated custom category.',
  })
  @ApiParam({ name: 'id', description: 'Category ID (CUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Category reactivated successfully',
    type: CategoryResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Cannot modify system categories',
  })
  async reactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.reactivate(user.sub, id);
  }
}
