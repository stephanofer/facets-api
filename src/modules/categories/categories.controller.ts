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
import { CurrentPrincipal } from '@common/decorators/current-principal.decorator';
import { RequireFeature } from '@common/decorators/feature.decorator';
import { RequireWorkspaceRole } from '@common/decorators/workspace-role.decorator';
import { FeatureGuard } from '@common/guards/feature.guard';
import { ParseCuidPipe } from '@common/pipes/parse-cuid.pipe';
import { FEATURES } from '@modules/subscriptions/constants/features.constant';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import { WorkspaceRole } from '../../generated/prisma/client';

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
  @RequireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
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
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.create(principal.workspaceId, dto);
  }

  /**
   * List all categories (system + custom)
   */
  @Get()
  @RequireWorkspaceRole(
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.GUEST,
  )
  @ApiOperation({
    summary: 'List categories',
    description:
      'Get all categories for the authenticated workspace. Includes system categories (shared) and workspace custom categories. Returns tree structure by default.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Category tree (or flat list if ?flat=true)',
    type: CategoryTreeResponseDto,
  })
  async findAll(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: QueryCategoryDto,
  ): Promise<CategoryTreeResponseDto> {
    return this.categoriesService.findAll(principal.workspaceId, query);
  }

  /**
   * Get a single category with its children
   */
  @Get(':id')
  @RequireWorkspaceRole(
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.GUEST,
  )
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
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseCuidPipe) id: string,
  ): Promise<CategoryWithChildrenDto> {
    return this.categoriesService.findById(principal.workspaceId, id);
  }

  /**
   * Update a custom category
   */
  @Put(':id')
  @RequireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
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
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.update(principal.workspaceId, id, dto);
  }

  /**
   * Delete a custom category
   */
  @Delete(':id')
  @RequireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
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
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseCuidPipe) id: string,
  ): Promise<void> {
    return this.categoriesService.delete(principal.workspaceId, id);
  }

  /**
   * Deactivate a custom category (soft delete)
   */
  @Patch(':id/deactivate')
  @RequireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
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
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseCuidPipe) id: string,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.deactivate(principal.workspaceId, id);
  }

  /**
   * Reactivate a custom category
   */
  @Patch(':id/reactivate')
  @RequireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
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
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseCuidPipe) id: string,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.reactivate(principal.workspaceId, id);
  }
}
