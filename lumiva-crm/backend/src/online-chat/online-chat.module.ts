// src/online-chat/online-chat.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChatSession } from './chat-session.entity';
import { ChatMessage } from './chat-message.entity';
import { OnlineChatService } from './online-chat.service';
import { OnlineChatController } from './online-chat.controller';
import { PublicOnlineChatController } from './public-online-chat.controller';
import { Tenant } from '../tenants/tenant.entity';
import { Lead } from '../leads/lead.entity';
import { LeadsModule } from '../leads/leads.module'; // 👈 нужно для создания лидов из чата

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatSession,
      ChatMessage,
      Tenant,
      Lead,
    ]),
    LeadsModule, // 👈 подтягиваем LeadsService внутрь OnlineChatService
  ],
  controllers: [
    OnlineChatController,       // внутренний (CRM)
    PublicOnlineChatController, // публичный /v1/public/online-chat/...
  ],
  providers: [OnlineChatService],
  exports: [OnlineChatService],
})
export class OnlineChatModule {}