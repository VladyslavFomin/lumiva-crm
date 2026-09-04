// src/data-visibility/data-visibility.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StaffDataVisibilityRule } from './data-visibility-rule.entity';
import { TenantIpAllowlistEntry } from './tenant-ip-allowlist.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { User } from '../users/user.entity';
import { Department } from '../departments/department.entity';
import { Contact } from '../contacts/contact.entity';
import { Company } from '../companies/company.entity';
import { Sale } from '../sales/sale.entity';
import { Lead } from '../leads/lead.entity';
import { DataVisibilityService } from './data-visibility.service';
import { DataVisibilityController } from './data-visibility.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StaffDataVisibilityRule,
      TenantIpAllowlistEntry,
      StaffUser,
      User,
      Department,
      Contact,
      Company,
      Sale,
      Lead,
    ]),
  ],
  providers: [DataVisibilityService],
  controllers: [DataVisibilityController],
  exports: [DataVisibilityService],
})
export class DataVisibilityModule {}
