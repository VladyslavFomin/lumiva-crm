import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../companies/company.entity';
import { Contact } from '../contacts/contact.entity';
import { AmocrmApiService } from '../integrations/amocrm/amocrm-api.service';
import { BitrixRestService } from '../integrations/bitrix/bitrix-rest.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { Lead } from '../leads/lead.entity';
import { RbacModule } from '../rbac/rbac.module';
import { StaffUser } from '../staff/staff-user.entity';
import { Tenant } from '../tenants/tenant.entity';
import { CrmMigrationExternalId } from './crm-migration-external-id.entity';
import { CrmMigrationRun } from './crm-migration-run.entity';
import { CrmMigrationController } from './crm-migration.controller';
import { CrmMigrationService } from './crm-migration.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CrmMigrationRun, CrmMigrationExternalId, Company, Contact, Lead, StaffUser, Tenant]),
    IntegrationsModule,
    RbacModule,
  ],
  controllers: [CrmMigrationController],
  providers: [CrmMigrationService, AmocrmApiService, BitrixRestService],
})
export class CrmMigrationModule {}
