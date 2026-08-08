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

@Module({
  imports: [
    TypeOrmModule.forFeature([Company, CompanyTask, Lead, Project, Contact]),
    RbacModule,
    forwardRef(() => AutomationsModule),
    AuditLogModule,
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}

