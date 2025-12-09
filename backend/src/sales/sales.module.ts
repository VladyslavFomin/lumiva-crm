// src/sales/sales.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Sale } from './sale.entity';
import { SalesChannel } from '../sales-channels/sales-channel.entity';
import { IntegrationConnection } from '../integrations/integration-connection.entity';

import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SalesChannel,          // ← чтобы был SalesChannelRepository
      IntegrationConnection, // ← чтобы был IntegrationConnectionRepository
    ]),
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}