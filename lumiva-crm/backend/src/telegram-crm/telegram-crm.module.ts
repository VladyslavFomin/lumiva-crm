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
import { TelegramAiToolsService } from './telegram-ai-tools';
import { BookingsModule } from '../bookings/bookings.module';
import { SalesModule } from '../sales/sales.module';
import { ContactsModule } from '../contacts/contacts.module';

// Note: HelpdeskModule is deliberately NOT imported here even though TelegramAiToolsService
// calls into HelpdeskService — HelpdeskModule already imports TelegramCrmModule (for its own
// TelegramCrmService dependency), so importing it back here would recreate the exact circular
// module-loading failure this comment is warning about. TelegramAiToolsService reaches
// HelpdeskService through a lazy ModuleRef.get(..., { strict: false }) global lookup instead
// (see telegram-ai-tools.ts) — same pattern this service already uses for AiAssistantService.

@Module({
  imports: [
    TypeOrmModule.forFeature([TelegramBot, TelegramContact, TelegramMessage, Lead, StaffUser]),
    RbacModule,
    forwardRef(() => AutomationsModule),
    forwardRef(() => LeadsModule),
    forwardRef(() => NotesModule),
    forwardRef(() => BookingsModule),
    forwardRef(() => SalesModule),
    forwardRef(() => ContactsModule),
  ],
  controllers: [TelegramCrmController, TelegramCrmPublicController],
  providers: [TelegramCrmService, TelegramBotSchedulerService, TelegramPollingService, TelegramAiToolsService],
  exports: [TelegramCrmService],
})
export class TelegramCrmModule {}

