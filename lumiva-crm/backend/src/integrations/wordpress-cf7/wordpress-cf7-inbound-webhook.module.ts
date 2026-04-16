import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IntegrationConnection } from '../integration-connection.entity';
import { LeadsModule } from '../../leads/leads.module';
import { NotesModule } from '../../notes/notes.module';
import { WordpressCf7InboundWebhookController } from './wordpress-cf7-inbound-webhook.controller';
import { WordpressCf7InboundWebhookService } from './wordpress-cf7-inbound-webhook.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IntegrationConnection]),
    forwardRef(() => LeadsModule),
    forwardRef(() => NotesModule),
  ],
  controllers: [WordpressCf7InboundWebhookController],
  providers: [WordpressCf7InboundWebhookService],
  exports: [WordpressCf7InboundWebhookService],
})
export class WordpressCf7InboundWebhookModule {}
