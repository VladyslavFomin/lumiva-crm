import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmsConfig } from './sms-config.entity';
import { SmsMessage } from './sms-message.entity';
import { SmsService } from './sms.service';
import { SmsController } from './sms.controller';
import { SmsWebhookController } from './sms-webhook.controller';
import { RbacModule } from '../rbac/rbac.module';
import { Lead } from '../leads/lead.entity';
import { LeadsModule } from '../leads/leads.module';
import { NotesModule } from '../notes/notes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SmsConfig, SmsMessage, Lead]),
    RbacModule,
    forwardRef(() => LeadsModule),
    forwardRef(() => NotesModule),
  ],
  controllers: [SmsController, SmsWebhookController],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
