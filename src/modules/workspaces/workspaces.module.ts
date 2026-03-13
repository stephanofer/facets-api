import { Module } from '@nestjs/common';
import { WorkspacesController } from '@modules/workspaces/workspaces.controller';
import { WorkspacesRepository } from '@modules/workspaces/workspaces.repository';
import { WorkspacesService } from '@modules/workspaces/workspaces.service';

@Module({
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspacesRepository],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
