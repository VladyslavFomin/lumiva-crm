// src/telegram-crm/telegram-crm.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramCrmController } from './telegram-crm.controller';
import { TelegramCrmPublicController } from './telegram-crm-public.controller';
import { TelegramCrmService } from './telegram-crm.service';
import { TelegramBot } from './telegram-bot.entity';
import { TelegramContact } from './telegram-contact.entity';
import { TelegramMessage } from './telegram-message.entity';
import { Lead } from '../leads/lead.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { RbacModule } from '../rbac/rbac.module';
import { AutomationsModule } from '../automations/automations.module';
import { LeadsModule } from '../leads/leads.module';
import { NotesModule } from '../notes/notes.module';
import { TelegramBotSchedulerService } from './telegram-bot-scheduler.service';
import { TelegramPollingService } from './telegram-polling.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TelegramBot, TelegramContact, TelegramMessage, Lead, StaffUser]),
    RbacModule,
    forwardRef(() => AutomationsModule),
    forwardRef(() => LeadsModule),
    forwardRef(() => NotesModule),
  ],
  controllers: [TelegramCrmController, TelegramCrmPublicController],
  providers: [TelegramCrmService, TelegramBotSchedulerService, TelegramPollingService],
  exports: [TelegramCrmService],
})
export class TelegramCrmModule {}

