import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceArea } from './workspace-area.entity';
import { CustomObject } from '../custom-objects/custom-object.entity';
import { WorkspaceAreasService } from './workspace-areas.service';
import { WorkspaceAreasController } from './workspace-areas.controller';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceArea, CustomObject]), RbacModule],
  controllers: [WorkspaceAreasController],
  providers: [WorkspaceAreasService],
  exports: [WorkspaceAreasService],
})
export class WorkspaceAreasModule {}
