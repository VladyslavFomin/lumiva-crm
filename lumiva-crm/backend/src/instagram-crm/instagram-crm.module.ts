import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lead } from '../leads/lead.entity';
import { LeadsModule } from '../leads/leads.module';
import { NotesModule } from '../notes/notes.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { RbacModule } from '../rbac/rbac.module';
import { InstagramAccount } from './instagram-account.entity';
import { InstagramContact } from './instagram-contact.entity';
import { InstagramMessage } from './instagram-message.entity';
import { InstagramCrmController } from './instagram-crm.controller';
import { InstagramCrmService } from './instagram-crm.service';
import { InstagramGraphService } from './instagram-graph.service';
import { InstagramWebhookController } from './instagram-webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([InstagramAccount, InstagramContact, InstagramMessage, Lead]),
    PlatformSettingsModule,
    forwardRef(() => LeadsModule),
    forwardRef(() => NotesModule),
    RbacModule,
  ],
  controllers: [InstagramCrmController, InstagramWebhookController],
  providers: [InstagramCrmService, InstagramGraphService],
  exports: [InstagramCrmService],
})
export class InstagramCrmModule {}
