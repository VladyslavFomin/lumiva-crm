// src/sales/sales.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Sale } from './sale.entity';
import { AnalyticsPreset } from './sales-analytics-preset.entity';
import { SalesImportSession } from './sales-import-session.entity';
import { SalesChannel } from '../sales-channels/sales-channel.entity';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';

import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { SalesImportController } from './sales-import.controller';
import { SalesImportService } from './sales-import.service';
import { AutomationsModule } from '../automations/automations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SalesChannel,          // ← чтобы был SalesChannelRepository
      IntegrationConnection, // ← чтобы был IntegrationConnectionRepository
      AnalyticsPreset,
      SalesImportSession,
    ]),
    CustomFieldsModule,
    forwardRef(() => AutomationsModule),
  ],
  controllers: [SalesController, SalesImportController],
  providers: [SalesService, SalesImportService],
  exports: [SalesService, SalesImportService],
})
export class SalesModule {}
