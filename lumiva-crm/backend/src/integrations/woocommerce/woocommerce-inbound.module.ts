// src/integrations/woocommerce/woocommerce-inbound.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationConnection } from '../integration-connection.entity';
import { Sale } from '../../sales/sale.entity';
import { WooCommerceInboundService } from './woocommerce-inbound.service';
import { WooCommerceInboundController } from './woocommerce-inbound.controller';
import { LeadsModule } from '../../leads/leads.module';
import { NotesModule } from '../../notes/notes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IntegrationConnection, Sale]),
    forwardRef(() => LeadsModule),
    forwardRef(() => NotesModule),
  ],
  controllers: [WooCommerceInboundController],
  providers: [WooCommerceInboundService],
  exports: [WooCommerceInboundService],
})
export class WooCommerceInboundModule {}
