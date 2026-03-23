// backend/src/leads/leads.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Lead } from './lead.entity';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { LeadsMeetingsReminderService } from './leads-meetings-reminder.service';

import { Site } from '../sites/site.entity';
import { LeadActivity } from './lead-activity.entity';
import { LeadActivityService } from './lead-activity.service';

import { TenantsModule } from '../tenants/tenants.module';
import { StaffUsersModule } from '../staff/staff-users.module';

import { User } from '../users/user.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { AuthModule } from '../auth/auth.module';
import { AutomationsModule } from '../automations/automations.module';
import { EmailModule } from '../email/email.module';

// 👇 сущность продаж — для ROI по лидам
import { Sale } from '../sales/sale.entity';

// 👇 добавляем сущность проекта — для ROI по проектам/лидам
import { Project } from '../projects/project.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lead,
      Site,
      LeadActivity,
      User,
      StaffUser,
      Sale,
      Project, // 🔴 ВАЖНО: добавили Project
    ]),

    forwardRef(() => TenantsModule),
    forwardRef(() => StaffUsersModule),
    forwardRef(() => AuthModule),
    forwardRef(() => AutomationsModule),
    forwardRef(() => EmailModule),
  ],
  controllers: [LeadsController],
  providers: [LeadsService, LeadActivityService, LeadsMeetingsReminderService],
  exports: [LeadsService, LeadActivityService],
})
export class LeadsModule {}