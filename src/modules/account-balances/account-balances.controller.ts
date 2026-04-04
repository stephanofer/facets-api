import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '@common/decorators/current-principal.decorator';
import { RequireWorkspaceRole } from '@common/decorators/workspace-role.decorator';
import { ParseCuidPipe } from '@common/pipes/parse-cuid.pipe';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import { AccountBalancesService } from '@modules/account-balances/account-balances.service';
import { BalanceSummaryResponseDto } from '@modules/account-balances/dtos/balance-summary-response.dto';
import { CreateAccountReconciliationDto } from '@modules/account-balances/dtos/create-account-reconciliation.dto';
import { DailyBalanceTimelineItemDto } from '@modules/account-balances/dtos/daily-balance-timeline-item.dto';
import { ListDailyBalancesQueryDto } from '@modules/account-balances/dtos/list-daily-balances-query.dto';
import { AccountReconciliationAuthorDto } from '@modules/account-balances/dtos/account-reconciliation-author.dto';
import { AccountReconciliationResponseDto } from '@modules/account-balances/dtos/account-reconciliation-response.dto';
import { UpdateAccountReconciliationDto } from '@modules/account-balances/dtos/update-account-reconciliation.dto';
import { WorkspaceRole } from '@/generated/prisma/client';

@ApiTags('Account Balances')
@ApiBearerAuth()
@ApiExtraModels(
  AccountReconciliationResponseDto,
  AccountReconciliationAuthorDto,
  BalanceSummaryResponseDto,
  DailyBalanceTimelineItemDto,
)
@Controller('accounts/:accountId')
export class AccountBalancesController {
  constructor(
    private readonly accountBalancesService: AccountBalancesService,
  ) {}

  @Post('reconciliations')
  @RequireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({
    summary: 'Create an account reconciliation',
    description:
      'Register an observed balance for one account and date. This adjusts balance state only and never creates fake cashflow transactions.',
  })
  @ApiParam({ name: 'accountId', description: 'Account CUID identifier' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Reconciliation created successfully',
    type: AccountReconciliationResponseDto,
  })
  async createReconciliation(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('accountId', ParseCuidPipe) accountId: string,
    @Body() dto: CreateAccountReconciliationDto,
  ): Promise<AccountReconciliationResponseDto> {
    return this.accountBalancesService.createReconciliation(
      principal,
      accountId,
      dto,
    );
  }

  @Get('reconciliations')
  @RequireWorkspaceRole(
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.GUEST,
  )
  @ApiOperation({
    summary: 'List reconciliations for one account',
    description:
      'Return the audit trail of reconciliations for one workspace-scoped account, marking which row is currently effective for each date.',
  })
  @ApiParam({ name: 'accountId', description: 'Account CUID identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reconciliations ordered by date and recency',
    type: AccountReconciliationResponseDto,
    isArray: true,
  })
  async listReconciliations(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('accountId', ParseCuidPipe) accountId: string,
  ): Promise<AccountReconciliationResponseDto[]> {
    return this.accountBalancesService.listReconciliations(
      principal,
      accountId,
    );
  }

  @Get('reconciliations/:reconciliationId')
  @RequireWorkspaceRole(
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.GUEST,
  )
  @ApiOperation({
    summary: 'Get reconciliation detail',
    description:
      'Return one reconciliation inside the current workspace account boundary, including author and effective status.',
  })
  @ApiParam({ name: 'accountId', description: 'Account CUID identifier' })
  @ApiParam({
    name: 'reconciliationId',
    description: 'Account reconciliation CUID identifier',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reconciliation detail',
    type: AccountReconciliationResponseDto,
  })
  async getReconciliationById(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('accountId', ParseCuidPipe) accountId: string,
    @Param('reconciliationId', ParseCuidPipe) reconciliationId: string,
  ): Promise<AccountReconciliationResponseDto> {
    return this.accountBalancesService.getReconciliationById(
      principal,
      accountId,
      reconciliationId,
    );
  }

  @Patch('reconciliations/:reconciliationId')
  @RequireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({
    summary: 'Update a reconciliation',
    description:
      'Update the observed balance or date for one reconciliation and rematerialize daily balances from the earliest affected date.',
  })
  @ApiParam({ name: 'accountId', description: 'Account CUID identifier' })
  @ApiParam({
    name: 'reconciliationId',
    description: 'Account reconciliation CUID identifier',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reconciliation updated successfully',
    type: AccountReconciliationResponseDto,
  })
  async updateReconciliation(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('accountId', ParseCuidPipe) accountId: string,
    @Param('reconciliationId', ParseCuidPipe) reconciliationId: string,
    @Body() dto: UpdateAccountReconciliationDto,
  ): Promise<AccountReconciliationResponseDto> {
    return this.accountBalancesService.updateReconciliation(
      principal,
      accountId,
      reconciliationId,
      dto,
    );
  }

  @Delete('reconciliations/:reconciliationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({
    summary: 'Delete a reconciliation',
    description:
      'Delete one reconciliation, keep the audit boundary on the account, and recompute balances so the next most recent row becomes effective if applicable.',
  })
  @ApiParam({ name: 'accountId', description: 'Account CUID identifier' })
  @ApiParam({
    name: 'reconciliationId',
    description: 'Account reconciliation CUID identifier',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Reconciliation deleted successfully',
  })
  async deleteReconciliation(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('accountId', ParseCuidPipe) accountId: string,
    @Param('reconciliationId', ParseCuidPipe) reconciliationId: string,
  ): Promise<void> {
    await this.accountBalancesService.deleteReconciliation(
      principal,
      accountId,
      reconciliationId,
    );
  }

  @Get('balance-summary')
  @RequireWorkspaceRole(
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.GUEST,
  )
  @ApiOperation({
    summary: 'Get account balance summary',
    description:
      'Return the latest cached balance plus calculated, reconciled, and difference values for the current workspace account.',
  })
  @ApiParam({ name: 'accountId', description: 'Account CUID identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Balance summary',
    type: BalanceSummaryResponseDto,
  })
  async getBalanceSummary(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('accountId', ParseCuidPipe) accountId: string,
  ): Promise<BalanceSummaryResponseDto> {
    return this.accountBalancesService.getBalanceSummary(principal, accountId);
  }

  @Get('daily-balances')
  @RequireWorkspaceRole(
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.GUEST,
  )
  @ApiOperation({
    summary: 'Get daily balance timeline',
    description:
      'Return daily materialized balances for one account, including calculated balance, reconciled balance, and the adjustment difference for every day in range.',
  })
  @ApiParam({ name: 'accountId', description: 'Account CUID identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Daily balance timeline',
    type: DailyBalanceTimelineItemDto,
    isArray: true,
  })
  async getDailyBalances(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('accountId', ParseCuidPipe) accountId: string,
    @Query() query: ListDailyBalancesQueryDto,
  ): Promise<DailyBalanceTimelineItemDto[]> {
    return this.accountBalancesService.getDailyBalances(
      principal,
      accountId,
      query,
    );
  }
}
