// src/sales-channels/sales-channels.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SalesChannel } from './sales-channel.entity';
import { SalesChannelsService } from './sales-channels.service';
import { SalesChannelsController } from './sales-channels.controller';
import { IntegrationConnection } from '../integrations/integration-connection.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalesChannel,
      IntegrationConnection, // <─ добавили репозиторий интеграций
    ]),
  ],
  providers: [SalesChannelsService],
  controllers: [SalesChannelsController],
  exports: [SalesChannelsService],
})
export class SalesChannelsModule {}