// src/companies/companies.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { Company } from './company.entity';
import { CompanyTask } from './company-task.entity';
import { Lead } from '../leads/lead.entity';
import { Project } from '../projects/project.entity';
import { Contact } from '../contacts/contact.entity';
import { RbacModule } from '../rbac/rbac.module';
import { AutomationsModule } from '../automations/automations.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StaffUsersModule } from '../staff/staff-users.module';
import { DataVisibilityModule } from '../data-visibility/data-visibility.module';
import { CurrencyModule } from '../currency/currency.module';
import { Tenant } from '../tenants/tenant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Company, CompanyTask, Lead, Project, Contact, Tenant]),
    RbacModule,
    forwardRef(() => AutomationsModule),
    AuditLogModule,
    NotificationsModule,
    forwardRef(() => StaffUsersModule),
    DataVisibilityModule,
    CurrencyModule,
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}

