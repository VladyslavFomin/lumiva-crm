// backend/src/projects/projects.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Project } from './project.entity';
import { ProjectActivity } from './project-activity.entity';
import { ProjectStatusDefinition } from './project-status.entity';
import { ProjectTagDefinition } from './project-tag.entity';
import { ProjectCurrencyDefinition } from './project-currency.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ProjectStatusesService } from './project-statuses.service';
import { ProjectStatusesController } from './project-statuses.controller';
import { ProjectTagsService } from './project-tags.service';
import { ProjectTagsController } from './project-tags.controller';
import { ProjectCurrenciesService } from './project-currencies.service';
import { ProjectCurrenciesController } from './project-currencies.controller';
import { User } from '../users/user.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { Lead } from '../leads/lead.entity';
import { AutomationsModule } from '../automations/automations.module';
import { RbacModule } from '../rbac/rbac.module';
import { ProjectTablesModule } from '../project-tables/project-tables.module';
import { ProjectTable } from '../project-tables/project-table.entity';
import { ProjectTableAccessGuard } from '../project-tables/project-table-access.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { StaffUsersModule } from '../staff/staff-users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectActivity,
      ProjectStatusDefinition,
      ProjectTagDefinition,
      ProjectCurrencyDefinition,
      User,
      StaffUser,
      Lead,
      ProjectTable,
    ]),
    forwardRef(() => AutomationsModule),
    RbacModule,
    ProjectTablesModule,
    NotificationsModule,
    forwardRef(() => StaffUsersModule),
  ],
  controllers: [
    ProjectsController,
    ProjectStatusesController,
    ProjectTagsController,
    ProjectCurrenciesController,
  ],
  providers: [
    ProjectsService,
    ProjectStatusesService,
    ProjectTagsService,
    ProjectCurrenciesService,
    ProjectTableAccessGuard,
  ],
  exports: [ProjectsService, ProjectStatusesService],
})
export class ProjectsModule {}
