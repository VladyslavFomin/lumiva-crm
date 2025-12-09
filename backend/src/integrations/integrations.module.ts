// src/integrations/integrations.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IntegrationConnection } from './integration-connection.entity';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationRegistryService } from './integration-registry.service';

// адаптеры интеграций
import { WooCommerceAdapter } from './woocommerce/woocommerce.adapter';

// сущности из других модулей
import { Sale } from '../sales/sale.entity';
import { SalesChannel } from '../sales-channels/sales-channel.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IntegrationConnection,
      Sale,
      SalesChannel, // ← ВАЖНО: добавили канал продаж
    ]),
  ],
  providers: [
    IntegrationsService,
    IntegrationRegistryService,
    WooCommerceAdapter,
  ],
  controllers: [IntegrationsController],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}