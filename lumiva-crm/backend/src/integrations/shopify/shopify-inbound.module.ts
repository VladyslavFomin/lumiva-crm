// src/integrations/shopify/shopify-inbound.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationConnection } from '../integration-connection.entity';
import { Sale } from '../../sales/sale.entity';
import { ShopifyInboundService } from './shopify-inbound.service';
import { ShopifyInboundController } from './shopify-inbound.controller';
import { ShopifyApiService } from './shopify-api.service';
import { LeadsModule } from '../../leads/leads.module';
import { NotesModule } from '../../notes/notes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IntegrationConnection, Sale]),
    forwardRef(() => LeadsModule),
    forwardRef(() => NotesModule),
  ],
  controllers: [ShopifyInboundController],
  providers: [ShopifyInboundService, ShopifyApiService],
  exports: [ShopifyInboundService],
})
export class ShopifyInboundModule {}
