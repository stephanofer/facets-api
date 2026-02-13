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
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { RequireFeature } from '@common/decorators/feature.decorator';
import { FeatureGuard } from '@common/guards/feature.guard';
import { ParseCuidPipe } from '@common/pipes/parse-cuid.pipe';
import { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';
import { FEATURES } from '@modules/subscriptions/constants/features.constant';

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
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    return this.accountsService.create(user.sub, dto);
  }

  /**
   * List all accounts
   */
  @Get()
  @ApiOperation({
    summary: 'List accounts',
    description:
      'Get all accounts for the authenticated user. By default, archived accounts are hidden.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of accounts',
    type: AccountListResponseDto,
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryAccountDto,
  ): Promise<AccountListResponseDto> {
    return this.accountsService.findAll(user.sub, query);
  }

  /**
   * Get balance summary
   */
  @Get('summary')
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
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AccountSummaryResponseDto> {
    return this.accountsService.getBalanceSummary(user.sub);
  }

  /**
   * Get a single account
   */
  @Get(':id')
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
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ): Promise<AccountResponseDto> {
    return this.accountsService.findById(user.sub, id);
  }

  /**
   * Update an account
   */
  @Put(':id')
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
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    return this.accountsService.update(user.sub, id, dto);
  }

  /**
   * Delete an account (only if no transactions)
   */
  @Delete(':id')
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
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ): Promise<void> {
    return this.accountsService.delete(user.sub, id);
  }

  /**
   * Archive an account
   */
  @Patch(':id/archive')
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
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ): Promise<AccountResponseDto> {
    return this.accountsService.archive(user.sub, id);
  }

  /**
   * Unarchive an account
   */
  @Patch(':id/unarchive')
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
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ): Promise<AccountResponseDto> {
    return this.accountsService.unarchive(user.sub, id);
  }
}
