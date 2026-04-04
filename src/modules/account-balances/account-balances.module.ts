import { Module } from '@nestjs/common';
import { AccountBalancesController } from '@modules/account-balances/account-balances.controller';
import { AccountBalancesRepository } from '@modules/account-balances/account-balances.repository';
import { AccountBalancesService } from '@modules/account-balances/account-balances.service';
import { AccountBalanceRecomputeService } from '@modules/account-balances/domain/account-balance-recompute.service';

@Module({
  controllers: [AccountBalancesController],
  providers: [
    AccountBalancesRepository,
    AccountBalancesService,
    AccountBalanceRecomputeService,
  ],
  exports: [AccountBalancesService, AccountBalanceRecomputeService],
})
export class AccountBalancesModule {}
