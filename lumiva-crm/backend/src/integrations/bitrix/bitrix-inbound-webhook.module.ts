import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IntegrationConnection } from '../integration-connection.entity';
import { Lead } from '../../leads/lead.entity';
import { LeadsModule } from '../../leads/leads.module';
import { NotesModule } from '../../notes/notes.module';
import { BitrixInboundWebhookController } from './bitrix-inbound-webhook.controller';
import { BitrixInboundWebhookService } from './bitrix-inbound-webhook.service';
import { BitrixRestService } from './bitrix-rest.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IntegrationConnection, Lead]),
    forwardRef(() => LeadsModule),
    forwardRef(() => NotesModule),
  ],
  controllers: [BitrixInboundWebhookController],
  providers: [BitrixInboundWebhookService, BitrixRestService],
  exports: [BitrixInboundWebhookService],
})
export class BitrixInboundWebhookModule {}
