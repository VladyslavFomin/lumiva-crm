// backend/src/leads/leads.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Lead } from './lead.entity';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { PublicLeadsController } from './public-leads.controller';
import { LeadsMeetingsReminderService } from './leads-meetings-reminder.service';
import { LeadAccessGrant } from './lead-access-grant.entity';
import { LeadAccessService } from './lead-access.service';
import { Department } from '../departments/department.entity';

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
import { IntegrationsModule } from '../integrations/integrations.module';
import { AiEmployeesModule } from '../ai-employees/ai-employees.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RbacModule } from '../rbac/rbac.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DataVisibilityModule } from '../data-visibility/data-visibility.module';

// 👇 сущность продаж — для ROI по лидам
import { Sale } from '../sales/sale.entity';
import { SalesChannel } from '../sales-channels/sales-channel.entity';
import { Project } from '../projects/project.entity';

// 👇 для конвертации лида в клиента (POST /leads/:id/convert)
import { ContactsModule } from '../contacts/contacts.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lead,
      Site,
      LeadActivity,
      User,
      StaffUser,
      Sale,
      SalesChannel,
      Project, // 🔴 ВАЖНО: добавили Project
      LeadAccessGrant,
      Department,
    ]),

    forwardRef(() => TenantsModule),
    forwardRef(() => StaffUsersModule),
    forwardRef(() => AuthModule),
    forwardRef(() => AutomationsModule),
    forwardRef(() => EmailModule),
    forwardRef(() => IntegrationsModule),
    forwardRef(() => AiEmployeesModule),
    AuditLogModule,
    RbacModule,
    NotificationsModule,
    DataVisibilityModule,
    ContactsModule,
    CompaniesModule,
  ],
  controllers: [LeadsController, PublicLeadsController],
  providers: [LeadsService, LeadActivityService, LeadsMeetingsReminderService, LeadAccessService],
  exports: [LeadsService, LeadActivityService, LeadAccessService],
})
export class LeadsModule {}