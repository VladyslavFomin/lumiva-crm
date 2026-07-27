// src/automations/automations.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';
import { Automation } from './automation.entity';
import { AutomationExecution } from './automation-execution.entity';
import { ReportsService } from './reports.service';
import { AutomationsSchedulerService } from './scheduler.service';
import { RbacModule } from '../rbac/rbac.module';
import { EmailModule } from '../email/email.module';
import { TelegramCrmModule } from '../telegram-crm/telegram-crm.module';
import { NotesModule } from '../notes/notes.module';
import { Lead } from '../leads/lead.entity';
import { Project } from '../projects/project.entity';
import { CompanyTask } from '../companies/company-task.entity';
import { Company } from '../companies/company.entity';
import { Contact } from '../contacts/contact.entity';
import { Sale } from '../sales/sale.entity';
import { SalesModule } from '../sales/sales.module';
import { CompaniesModule } from '../companies/companies.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { MarketingModule } from '../marketing/marketing.module';
import { CustomObjectsModule } from '../custom-objects/custom-objects.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StaffUsersModule } from '../staff/staff-users.module';
import { SmsModule } from '../sms/sms.module';
import { BookingsModule } from '../bookings/bookings.module';
import { HotelsModule } from '../hotels/hotels.module';

@Module({
  imports: [
    forwardRef(() => IntegrationsModule),
    forwardRef(() => CustomObjectsModule),
    MarketingModule,
    TypeOrmModule.forFeature([
      Automation,
      AutomationExecution,
      Lead,
      Contact,
      Company,
      Sale,
      Project,
      CompanyTask,
    ]),
    RbacModule,
    forwardRef(() => EmailModule),
    forwardRef(() => TelegramCrmModule),
    forwardRef(() => NotesModule),
    forwardRef(() => SalesModule),
    forwardRef(() => CompaniesModule),
    NotificationsModule,
    StaffUsersModule,
    SmsModule,
    forwardRef(() => BookingsModule),
    forwardRef(() => HotelsModule),
  ],
  controllers: [AutomationsController],
  providers: [AutomationsService, ReportsService, AutomationsSchedulerService],
  exports: [AutomationsService, ReportsService],
})
export class AutomationsModule {}
