import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectTable } from './project-table.entity';
import { ProjectTableMember } from './project-table-member.entity';
import { Project } from '../projects/project.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { ProjectTablesService } from './project-tables.service';
import { ProjectTableMembersService } from './project-table-members.service';
import { ProjectTablesController } from './project-tables.controller';
import { ProjectTableAccessGuard } from './project-table-access.guard';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectTable, ProjectTableMember, Project, StaffUser]),
    RbacModule,
  ],
  controllers: [ProjectTablesController],
  providers: [ProjectTablesService, ProjectTableMembersService, ProjectTableAccessGuard],
  exports: [ProjectTablesService, ProjectTableMembersService, ProjectTableAccessGuard],
})
export class ProjectTablesModule {}
