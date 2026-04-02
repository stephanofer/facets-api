import { Module } from '@nestjs/common';
import { ReferenceController } from '@modules/reference/reference.controller';
import { ReferenceRepository } from '@modules/reference/reference.repository';
import { ReferenceService } from '@modules/reference/reference.service';

@Module({
  controllers: [ReferenceController],
  providers: [ReferenceService, ReferenceRepository],
  exports: [ReferenceService],
})
export class ReferenceModule {}
