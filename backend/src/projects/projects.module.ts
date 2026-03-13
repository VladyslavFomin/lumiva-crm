// backend/src/projects/projects.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Project } from './project.entity';
import { ProjectActivity } from './project-activity.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { User } from '../users/user.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { Lead } from '../leads/lead.entity';
import { AutomationsModule } from '../automations/automations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ProjectActivity, User, StaffUser, Lead]),
    forwardRef(() => AutomationsModule),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
