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
import { AccountsService } from '@modules/accounts/accounts.service';
import { CreateAccountDto } from '@modules/accounts/dtos/create-account.dto';
import { UpdateAccountDto } from '@modules/accounts/dtos/update-account.dto';
import { QueryAccountDto } from '@modules/accounts/dtos/query-account.dto';
import {
  AccountResponseDto,
  AccountListResponseDto,
  AccountSummaryResponseDto,
} from '@modules/accounts/dtos/account-response.dto';
import { CurrentPrincipal } from '@common/decorators/current-principal.decorator';
import { RequireFeature } from '@common/decorators/feature.decorator';
import { RequireWorkspaceRole } from '@common/decorators/workspace-role.decorator';
import { FeatureGuard } from '@common/guards/feature.guard';
import { ParseCuidPipe } from '@common/pipes/parse-cuid.pipe';
import { FEATURES } from '@modules/subscriptions/constants/features.constant';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import { WorkspaceRole } from '../../generated/prisma/client';

@ApiTags('Accounts')
@ApiBearerAuth()
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  /**
   * Create a new financial account
   */
  @Post()
  @UseGuards(FeatureGuard)
  @RequireFeature(FEATURES.ACCOUNTS)
  @RequireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({
    summary: 'Create account',
    description:
      'Create a new financial account (bank, card, cash, etc.). Subject to plan limits.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Account created successfully',
    type: AccountResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Account name already exists',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Account limit reached for current plan',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error or invalid credit card fields',
  })
  async create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    return this.accountsService.create(
      principal.workspaceId,
      principal.actorUserId,
      dto,
    );
  }

  /**
   * List all accounts
   */
  @Get()
  @RequireWorkspaceRole(
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.GUEST,
  )
  @ApiOperation({
    summary: 'List accounts',
    description:
      'Get all accounts for the authenticated workspace. By default, archived accounts are hidden.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of accounts',
    type: AccountListResponseDto,
  })
  async findAll(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: QueryAccountDto,
  ): Promise<AccountListResponseDto> {
    return this.accountsService.findAll(principal.workspaceId, query);
  }

  /**
   * Get balance summary
   */
  @Get('summary')
  @RequireWorkspaceRole(
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.GUEST,
  )
  @ApiOperation({
    summary: 'Balance summary',
    description:
      'Get total balance grouped by currency across all active accounts that are included in total.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Balance summary by currency',
    type: AccountSummaryResponseDto,
  })
  async getBalanceSummary(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AccountSummaryResponseDto> {
    return this.accountsService.getBalanceSummary(principal.workspaceId);
  }

  /**
   * Get a single account
   */
  @Get(':id')
  @RequireWorkspaceRole(
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.GUEST,
  )
  @ApiOperation({
    summary: 'Get account',
    description: 'Get details of a specific account.',
  })
  @ApiParam({ name: 'id', description: 'Account ID (CUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Account details',
    type: AccountResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Account not found',
  })
  async findById(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseCuidPipe) id: string,
  ): Promise<AccountResponseDto> {
    return this.accountsService.findById(principal.workspaceId, id);
  }

  /**
   * Update an account
   */
  @Put(':id')
  @RequireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({
    summary: 'Update account',
    description:
      'Update account details. Type and currency cannot be changed after creation.',
  })
  @ApiParam({ name: 'id', description: 'Account ID (CUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Account updated successfully',
    type: AccountResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Account not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Account name already exists',
  })
  async update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    return this.accountsService.update(
      principal.workspaceId,
      principal.actorUserId,
      id,
      dto,
    );
  }

  /**
   * Delete an account (only if no transactions)
   */
  @Delete(':id')
  @RequireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete account',
    description:
      'Permanently delete an account. Only possible if the account has no transactions. Use archive instead for accounts with transaction history.',
  })
  @ApiParam({ name: 'id', description: 'Account ID (CUID)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Account deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Account not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Account has transactions, archive instead',
  })
  async delete(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseCuidPipe) id: string,
  ): Promise<void> {
    return this.accountsService.delete(principal.workspaceId, id);
  }

  /**
   * Archive an account
   */
  @Patch(':id/archive')
  @RequireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({
    summary: 'Archive account',
    description:
      'Archive an account to hide it from the UI while preserving transaction history. Archived accounts do not count towards plan limits.',
  })
  @ApiParam({ name: 'id', description: 'Account ID (CUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Account archived successfully',
    type: AccountResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Account not found',
  })
  async archive(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseCuidPipe) id: string,
  ): Promise<AccountResponseDto> {
    return this.accountsService.archive(
      principal.workspaceId,
      principal.actorUserId,
      id,
    );
  }

  /**
   * Unarchive an account
   */
  @Patch(':id/unarchive')
  @RequireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({
    summary: 'Unarchive account',
    description:
      'Restore an archived account. Subject to plan limits — unarchiving may fail if you are at your account limit.',
  })
  @ApiParam({ name: 'id', description: 'Account ID (CUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Account unarchived successfully',
    type: AccountResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Account not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Account limit reached, cannot unarchive',
  })
  async unarchive(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseCuidPipe) id: string,
  ): Promise<AccountResponseDto> {
    return this.accountsService.unarchive(
      principal.workspaceId,
      principal.actorUserId,
      id,
    );
  }
}
