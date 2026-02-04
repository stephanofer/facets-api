import { Module } from '@nestjs/common';
import { UsersService } from '@modules/users/users.service';
import { UsersRepository } from '@modules/users/users.repository';

@Module({
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
