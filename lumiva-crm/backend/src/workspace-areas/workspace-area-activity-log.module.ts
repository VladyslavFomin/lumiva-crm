import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceAreaActivityLog } from './workspace-area-activity-log.entity';
import { WorkspaceAreaActivityLogService } from './workspace-area-activity-log.service';

/** Standalone, zero outgoing deps beyond TypeORM — safe to import from CustomObjectsModule,
 * IntegrationsModule and WorkspaceAreasModule alike without creating a cycle. */
@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceAreaActivityLog])],
  providers: [WorkspaceAreaActivityLogService],
  exports: [WorkspaceAreaActivityLogService],
})
export class WorkspaceAreaActivityLogModule {}
