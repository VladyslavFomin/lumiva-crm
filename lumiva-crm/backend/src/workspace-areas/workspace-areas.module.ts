import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceArea } from './workspace-area.entity';
import { WorkspaceAreaMember } from './workspace-area-member.entity';
import { CustomObject } from '../custom-objects/custom-object.entity';
import { CustomObjectRecord } from '../custom-objects/custom-object-record.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { WorkspaceAreasService } from './workspace-areas.service';
import { WorkspaceAreaMembersService } from './workspace-area-members.service';
import { WorkspaceAreasController } from './workspace-areas.controller';
import { RbacModule } from '../rbac/rbac.module';
import { WorkspaceAreaActivityLogModule } from './workspace-area-activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceArea,
      WorkspaceAreaMember,
      CustomObject,
      CustomObjectRecord,
      StaffUser,
    ]),
    RbacModule,
    WorkspaceAreaActivityLogModule,
  ],
  controllers: [WorkspaceAreasController],
  providers: [WorkspaceAreasService, WorkspaceAreaMembersService],
  exports: [WorkspaceAreasService, WorkspaceAreaMembersService],
})
export class WorkspaceAreasModule {}
