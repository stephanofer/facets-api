import {
  Body,
  Controller,
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
import { AccountsService } from '@modules/accounts/accounts.service';
import {
  CreateCreditCardProfileDto,
  CreateDebtProfileDto,
  CreateLentMoneyProfileDto,
  CreateLoanProfileDto,
  CreditCardProfileResponseDto,
  DebtProfileResponseDto,
  LentMoneyProfileResponseDto,
  LoanProfileResponseDto,
} from '@modules/accounts/dtos/account-profile.dto';
import { AccountResponseDto } from '@modules/accounts/dtos/account-response.dto';
import { CreateAccountDto } from '@modules/accounts/dtos/create-account.dto';
import { ListAccountsQueryDto } from '@modules/accounts/dtos/list-accounts-query.dto';
import { UpdateAccountDto } from '@modules/accounts/dtos/update-account.dto';
import { WorkspaceRole } from '@/generated/prisma/client';

@ApiTags('Accounts')
@ApiBearerAuth()
@ApiExtraModels(
  AccountResponseDto,
  CreateCreditCardProfileDto,
  CreateDebtProfileDto,
  CreateLoanProfileDto,
  CreateLentMoneyProfileDto,
  CreditCardProfileResponseDto,
  DebtProfileResponseDto,
  LoanProfileResponseDto,
  LentMoneyProfileResponseDto,
)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @RequireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({
    summary: 'Create an account',
    description:
      'Create a workspace-scoped account foundation record and, when compatible, one typed specialized profile. This surface intentionally excludes balances, transfers, reconciliation, and reporting math.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Account created successfully',
    type: AccountResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid account payload or incompatible profile',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only workspace admins and members can create accounts',
  })
  async create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    return this.accountsService.create(principal, dto);
  }

  @Get()
  @RequireWorkspaceRole(
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.GUEST,
  )
  @ApiOperation({
    summary: 'List accounts',
    description:
      'List only accounts that belong to the current principal workspace. Omitting the status filter returns only ACTIVE accounts.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Workspace-scoped accounts',
    type: AccountResponseDto,
    isArray: true,
  })
  async list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: ListAccountsQueryDto,
  ): Promise<AccountResponseDto[]> {
    return this.accountsService.list(principal, query);
  }

  @Get(':id')
  @RequireWorkspaceRole(
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.GUEST,
  )
  @ApiOperation({
    summary: 'Get account detail',
    description:
      'Return a single account from the current workspace. Detail supports both ACTIVE and ARCHIVED records but never crosses workspace boundaries.',
  })
  @ApiParam({ name: 'id', description: 'Account CUID identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Account detail',
    type: AccountResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Account not found in the current workspace',
  })
  async getById(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseCuidPipe) accountId: string,
  ): Promise<AccountResponseDto> {
    return this.accountsService.getById(principal, accountId);
  }

  @Patch(':id')
  @RequireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({
    summary: 'Update mutable account metadata',
    description:
      'Update only mutable Accounts Core metadata: name, includeInReports, notes, and a compatible typed profile. Immutable lifecycle and financial seed fields are rejected explicitly.',
  })
  @ApiParam({ name: 'id', description: 'Account CUID identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Account updated successfully',
    type: AccountResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Immutable fields cannot be changed',
  })
  async update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseCuidPipe) accountId: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    return this.accountsService.update(principal, accountId, dto);
  }

  @Patch(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({
    summary: 'Archive an account',
    description:
      'Archive an account explicitly without mutating includeInReports or any downstream financial computations.',
  })
  @ApiParam({ name: 'id', description: 'Account CUID identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Account archived successfully',
    type: AccountResponseDto,
  })
  async archive(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseCuidPipe) accountId: string,
  ): Promise<AccountResponseDto> {
    return this.accountsService.archive(principal, accountId);
  }

  @Patch(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @RequireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({
    summary: 'Reactivate an account',
    description:
      'Return an archived account to ACTIVE explicitly while preserving independent metadata like includeInReports.',
  })
  @ApiParam({ name: 'id', description: 'Account CUID identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Account reactivated successfully',
    type: AccountResponseDto,
  })
  async reactivate(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseCuidPipe) accountId: string,
  ): Promise<AccountResponseDto> {
    return this.accountsService.reactivate(principal, accountId);
  }
}
