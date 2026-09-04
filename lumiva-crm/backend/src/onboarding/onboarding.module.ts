// src/onboarding/onboarding.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Company } from '../companies/company.entity';
import { Contact } from '../contacts/contact.entity';
import { Lead } from '../leads/lead.entity';
import { Product } from '../products/product.entity';
import { Sale } from '../sales/sale.entity';
import { SalesChannel } from '../sales-channels/sales-channel.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { Project } from '../projects/project.entity';
import { OnboardingSampleRecord } from './onboarding-sample-record.entity';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, Company, Contact, Lead, Product, Sale, SalesChannel, StaffUser, Project, OnboardingSampleRecord]),
  ],
  providers: [OnboardingService],
  controllers: [OnboardingController],
})
export class OnboardingModule {}
