import { Module } from '@nestjs/common';
import { MeController } from '@modules/me/me.controller';
import { MeRepository } from '@modules/me/me.repository';
import { MeService } from '@modules/me/me.service';

@Module({
  controllers: [MeController],
  providers: [MeService, MeRepository],
  exports: [MeService],
})
export class MeModule {}
