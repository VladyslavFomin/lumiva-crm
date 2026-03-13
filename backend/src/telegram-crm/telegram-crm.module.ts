// src/telegram-crm/telegram-crm.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramCrmController } from './telegram-crm.controller';
import { TelegramCrmService } from './telegram-crm.service';
import { TelegramBot } from './telegram-bot.entity';
import { TelegramContact } from './telegram-contact.entity';
import { TelegramMessage } from './telegram-message.entity';
import { RbacModule } from '../rbac/rbac.module';
import { AutomationsModule } from '../automations/automations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TelegramBot, TelegramContact, TelegramMessage]),
    RbacModule,
    forwardRef(() => AutomationsModule),
  ],
  controllers: [TelegramCrmController],
  providers: [TelegramCrmService],
  exports: [TelegramCrmService],
})
export class TelegramCrmModule {}

