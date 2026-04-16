import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IntegrationConnection } from '../integration-connection.entity';
import { Lead } from '../../leads/lead.entity';
import { LeadsModule } from '../../leads/leads.module';
import { NotesModule } from '../../notes/notes.module';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappWebhookService } from './whatsapp-webhook.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IntegrationConnection, Lead]),
    forwardRef(() => LeadsModule),
    forwardRef(() => NotesModule),
  ],
  controllers: [WhatsappWebhookController],
  providers: [WhatsappWebhookService],
  exports: [WhatsappWebhookService],
})
export class WhatsappWebhookModule {}
