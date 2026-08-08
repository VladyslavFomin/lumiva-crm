// src/contacts/contacts.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { Contact } from './contact.entity';
import { Lead } from '../leads/lead.entity';
import { Project } from '../projects/project.entity';
import { Company } from '../companies/company.entity';
import { RbacModule } from '../rbac/rbac.module';
import { AutomationsModule } from '../automations/automations.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contact, Lead, Project, Company]),
    RbacModule,
    forwardRef(() => AutomationsModule),
    AuditLogModule,
  ],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}

