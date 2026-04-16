import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IntegrationConnection } from '../integration-connection.entity';
import { Lead } from '../../leads/lead.entity';
import { LeadsModule } from '../../leads/leads.module';
import { NotesModule } from '../../notes/notes.module';
import { AmocrmInboundWebhookController } from './amocrm-inbound-webhook.controller';
import { AmocrmInboundWebhookService } from './amocrm-inbound-webhook.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IntegrationConnection, Lead]),
    forwardRef(() => LeadsModule),
    forwardRef(() => NotesModule),
  ],
  controllers: [AmocrmInboundWebhookController],
  providers: [AmocrmInboundWebhookService],
  exports: [AmocrmInboundWebhookService],
})
export class AmocrmInboundWebhookModule {}
