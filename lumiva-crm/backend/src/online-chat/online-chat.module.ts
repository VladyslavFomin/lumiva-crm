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
import { RbacModule } from '../rbac/rbac.module';
import { AiAgent } from '../ai-employees/ai-agent.entity';
import { AiEmployeesModule } from '../ai-employees/ai-employees.module';
import { OnlineChatAiService } from './online-chat-ai.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatSession,
      ChatMessage,
      Tenant,
      Lead,
      AiAgent,
    ]),
    LeadsModule, // 👈 подтягиваем LeadsService внутрь OnlineChatService
    RbacModule,
    AiEmployeesModule, // ИИ-онлайн-консультант (роль chat_operator)
  ],
  controllers: [
    OnlineChatController,       // внутренний (CRM)
    PublicOnlineChatController, // публичный /v1/public/online-chat/...
  ],
  providers: [OnlineChatService, OnlineChatAiService],
  exports: [OnlineChatService],
})
export class OnlineChatModule {}