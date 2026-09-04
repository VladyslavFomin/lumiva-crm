// src/sales/sales.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Sale } from './sale.entity';
import { AnalyticsPreset } from './sales-analytics-preset.entity';
import { SalesImportSession } from './sales-import-session.entity';
import { SalesChannel } from '../sales-channels/sales-channel.entity';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { Lead } from '../leads/lead.entity';
import { Contact } from '../contacts/contact.entity';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';

import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { SalesImportController } from './sales-import.controller';
import { SalesImportService } from './sales-import.service';
import { AutomationsModule } from '../automations/automations.module';
import { LeadsModule } from '../leads/leads.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RbacModule } from '../rbac/rbac.module';
import { DataVisibilityModule } from '../data-visibility/data-visibility.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SalesChannel,          // ← чтобы был SalesChannelRepository
      IntegrationConnection, // ← чтобы был IntegrationConnectionRepository
      AnalyticsPreset,
      SalesImportSession,
      Lead,
      Contact,
    ]),
    CustomFieldsModule,
    forwardRef(() => AutomationsModule),
    forwardRef(() => LeadsModule),
    AuditLogModule,
    RbacModule,
    DataVisibilityModule,
  ],
  controllers: [SalesController, SalesImportController],
  providers: [SalesService, SalesImportService],
  exports: [SalesService, SalesImportService],
})
export class SalesModule {}
