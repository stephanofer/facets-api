import { Module } from '@nestjs/common';
import { AccountsController } from '@modules/accounts/accounts.controller';
import { AccountsRepository } from '@modules/accounts/accounts.repository';
import { AccountsService } from '@modules/accounts/accounts.service';
import { AccountProfilePayloadValidator } from '@modules/accounts/domain/account-profile-payload.validator';

@Module({
  controllers: [AccountsController],
  providers: [
    AccountsService,
    AccountsRepository,
    AccountProfilePayloadValidator,
  ],
  exports: [AccountsService],
})
export class AccountsModule {}
