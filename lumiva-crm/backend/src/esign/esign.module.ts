// src/esign/esign.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EsignDocument } from './esign-document.entity';
import { EsignTemplate } from './esign-template.entity';
import { Contact } from '../contacts/contact.entity';
import { Tenant } from '../tenants/tenant.entity';
import { Lead } from '../leads/lead.entity';
import { Company } from '../companies/company.entity';
import { Project } from '../projects/project.entity';
import { RbacModule } from '../rbac/rbac.module';
import { MailModule } from '../mail/mail.module';
import { EsignService } from './esign.service';
import { EsignController, EsignLinkOptionsController, EsignTemplateController } from './esign.controller';
import { EsignPublicController } from './esign-public.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EsignDocument, EsignTemplate, Contact, Tenant, Lead, Company, Project]), RbacModule, MailModule],
  providers: [EsignService],
  controllers: [EsignController, EsignLinkOptionsController, EsignTemplateController, EsignPublicController],
})
export class EsignModule {}
