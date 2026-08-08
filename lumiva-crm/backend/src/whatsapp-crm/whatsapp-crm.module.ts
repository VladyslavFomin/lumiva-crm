// src/whatsapp-crm/whatsapp-crm.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappCrmController } from './whatsapp-crm.controller';
import { WhatsappCrmService } from './whatsapp-crm.service';
import { WhatsappContact } from './whatsapp-contact.entity';
import { WhatsappMessage } from './whatsapp-message.entity';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { WhatsappCloudService } from '../integrations/whatsapp/whatsapp-cloud.service';
import { Lead } from '../leads/lead.entity';
import { RbacModule } from '../rbac/rbac.module';
import { LeadsModule } from '../leads/leads.module';
import { NotesModule } from '../notes/notes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WhatsappContact, WhatsappMessage, IntegrationConnection, Lead]),
    RbacModule,
    forwardRef(() => LeadsModule),
    forwardRef(() => NotesModule),
  ],
  controllers: [WhatsappCrmController],
  providers: [WhatsappCrmService, WhatsappCloudService],
  exports: [WhatsappCrmService],
})
export class WhatsappCrmModule {}
