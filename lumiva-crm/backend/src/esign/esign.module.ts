// src/esign/esign.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EsignDocument } from './esign-document.entity';
import { EsignTemplate } from './esign-template.entity';
import { EsignSequenceCounter } from './esign-sequence-counter.entity';
import { Contact } from '../contacts/contact.entity';
import { Tenant } from '../tenants/tenant.entity';
import { Lead } from '../leads/lead.entity';
import { Company } from '../companies/company.entity';
import { Project } from '../projects/project.entity';
import { Sale } from '../sales/sale.entity';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { BookingService } from '../bookings/booking-service.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { RbacModule } from '../rbac/rbac.module';
import { MailModule } from '../mail/mail.module';
import { EsignService } from './esign.service';
import { EsignController, EsignLinkOptionsController, EsignTemplateController } from './esign.controller';
import { EsignPublicController } from './esign-public.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EsignDocument,
      EsignTemplate,
      EsignSequenceCounter,
      Contact,
      Tenant,
      Lead,
      Company,
      Project,
      Sale,
      User,
      Product,
      BookingService,
      StaffUser,
    ]),
    RbacModule,
    MailModule,
  ],
  providers: [EsignService],
  controllers: [EsignController, EsignLinkOptionsController, EsignTemplateController, EsignPublicController],
})
export class EsignModule {}
