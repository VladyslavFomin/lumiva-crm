import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IntegrationConnection } from '../integration-connection.entity';
import { WhatsappCrmModule } from '../../whatsapp-crm/whatsapp-crm.module';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappWebhookService } from './whatsapp-webhook.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IntegrationConnection]),
    forwardRef(() => WhatsappCrmModule),
  ],
  controllers: [WhatsappWebhookController],
  providers: [WhatsappWebhookService],
  exports: [WhatsappWebhookService],
})
export class WhatsappWebhookModule {}
