import { Module } from '@nestjs/common';
import { AccountsController } from '@modules/accounts/accounts.controller';
import { AccountsService } from '@modules/accounts/accounts.service';
import { AccountsRepository } from '@modules/accounts/accounts.repository';
import { SubscriptionsModule } from '@modules/subscriptions/subscriptions.module';

@Module({
  imports: [SubscriptionsModule],
  controllers: [AccountsController],
  providers: [AccountsService, AccountsRepository],
  exports: [AccountsService],
})
export class AccountsModule {}
