// src/online-chat/online-chat.controller.ts

import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Query,
  UseGuards,
  Logger,
  Delete,
  Patch,
  ParseUUIDPipe,
} from '@nestjs/common';

import { OnlineChatService } from './online-chat.service';
import { OnlineChatAiService, type AiBookingConfig, type ChatOperatorConfig, type MessengerChannel, type MessengerOperatorConfig } from './online-chat-ai.service';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.interface';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { SendChatMessageDto } from './dto/send-chat-message.dto';

@Controller()
export class OnlineChatController {
  private readonly logger = new Logger(OnlineChatController.name);

  constructor(
    private readonly chat: OnlineChatService,
    private readonly chatAi: OnlineChatAiService,
  ) {}

  /* ================= ИИ-онлайн-консультант (роль chat_operator) ================= */

  // GET /v1/online-chat/ai/status — плашка на странице /chat
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('chat', 'read')
  @Get('online-chat/ai/status')
  async aiStatus(@CurrentUser() user: CurrentUserPayload) {
    return this.chatAi.getStatus(user.tenantId);
  }

  // PATCH /v1/online-chat/sessions/:id/ai { paused } — выключить/вернуть ИИ в диалоге
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('chat', 'write')
  @Patch('online-chat/sessions/:id/ai')
  async setSessionAi(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') sessionId: string,
    @Body() body: { paused?: boolean },
  ) {
    return this.chat.setSessionAiPaused(user.tenantId, sessionId, !!body?.paused);
  }

  // PATCH /v1/online-chat/sessions/:id/status { status: 'open' | 'closed' }
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('chat', 'write')
  @Patch('online-chat/sessions/:id/status')
  async setSessionStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') sessionId: string,
    @Body() body: { status?: string },
  ) {
    return this.chat.setSessionStatus(user.tenantId, sessionId, body?.status === 'closed' ? 'closed' : 'open');
  }

  /* ======= Запись в «Бронирования» ИИ-консультантом (сайт и мессенджеры) ======= */

  // GET /v1/ai-agents/:id/booking — галочка записи, разрешённые услуги, готовность модуля
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('ai_employees')
  @Get('ai-agents/:id/booking')
  async getAiBooking(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.chatAi.getBookingSettings(user.tenantId, id);
  }

  // PATCH /v1/ai-agents/:id/booking { enabled?, serviceIds?, allowChanges? }
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('ai_employees')
  @Patch('ai-agents/:id/booking')
  async setAiBooking(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: Partial<AiBookingConfig>,
  ) {
    return this.chatAi.updateBookingSettings(user.tenantId, id, body || {});
  }

  /* ======= Консультант мессенджеров в диалоге: пауза после ручного ответа и «Вернуть ИИ» ======= */

  // GET /v1/messenger-ai/whatsapp/:contactId
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('whatsapp', 'read')
  @Get('messenger-ai/whatsapp/:contactId')
  async waAiPause(@CurrentUser() user: CurrentUserPayload, @Param('contactId', new ParseUUIDPipe()) contactId: string) {
    return this.chatAi.getMessengerPause(user.tenantId, 'whatsapp', contactId);
  }

  // POST /v1/messenger-ai/whatsapp/:contactId/resume
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('whatsapp', 'write')
  @Post('messenger-ai/whatsapp/:contactId/resume')
  async waAiResume(@CurrentUser() user: CurrentUserPayload, @Param('contactId', new ParseUUIDPipe()) contactId: string) {
    return this.chatAi.resumeMessengerAi(user.tenantId, 'whatsapp', contactId);
  }

  // GET /v1/messenger-ai/telegram/:contactId
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('telegram', 'read')
  @Get('messenger-ai/telegram/:contactId')
  async tgAiPause(@CurrentUser() user: CurrentUserPayload, @Param('contactId', new ParseUUIDPipe()) contactId: string) {
    return this.chatAi.getMessengerPause(user.tenantId, 'telegram', contactId);
  }

  // POST /v1/messenger-ai/telegram/:contactId/resume
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('telegram', 'write')
  @Post('messenger-ai/telegram/:contactId/resume')
  async tgAiResume(@CurrentUser() user: CurrentUserPayload, @Param('contactId', new ParseUUIDPipe()) contactId: string) {
    return this.chatAi.resumeMessengerAi(user.tenantId, 'telegram', contactId);
  }

  // Настройки консультанта (бриф, лимиты) — права на ИИ-сотрудников, как у профиля сотрудника
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('ai_employees')
  @Get('ai-agents/:id/online-chat')
  async aiConfig(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.chatAi.getConfig(user.tenantId, id);
  }

  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('ai_employees')
  @Patch('ai-agents/:id/online-chat')
  async updateAiConfig(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: Partial<ChatOperatorConfig>,
  ) {
    return this.chatAi.updateConfig(user.tenantId, id, body || {});
  }

  // Проверка ответа на тестовый вопрос — ничего не сохраняет и не отправляет
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('ai_employees')
  @Post('ai-agents/:id/online-chat/test')
  async testAi(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: { question?: string; brief?: string },
  ) {
    return this.chatAi.testReply(user.tenantId, id, String(body?.question || ''), body?.brief);
  }

  /* ================= ИИ-консультант мессенджеров (роль messenger_operator) ================= */

  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('ai_employees')
  @Get('ai-agents/:id/messenger')
  async messengerConfig(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.chatAi.getMessengerConfig(user.tenantId, id);
  }

  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('ai_employees')
  @Patch('ai-agents/:id/messenger')
  async updateMessengerConfig(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: Partial<MessengerOperatorConfig>,
  ) {
    return this.chatAi.updateMessengerConfig(user.tenantId, id, body || {});
  }

  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('ai_employees')
  @Post('ai-agents/:id/messenger/test')
  async testMessenger(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: { channel?: MessengerChannel; question?: string; brief?: string },
  ) {
    return this.chatAi.testMessengerReply(user.tenantId, id, body?.channel === 'telegram' ? 'telegram' : 'whatsapp', String(body?.question || ''), body?.brief);
  }

  /* ============================================================
   * 1. STAFF API — CRM панель (требует JWT)
   * Итоговый путь: /v1/online-chat/...
   * ==========================================================*/

  // GET /v1/online-chat/sessions
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('chat', 'read')
  @Get('online-chat/sessions')
  async listSessions(
    @CurrentUser() user: CurrentUserPayload,
    @Query('status') status?: 'open' | 'closed',
    @Query('search') search?: string,
  ) {
    this.logger.debug(
      `listSessions: user=${JSON.stringify(user || {})}`,
    );

    return this.chat.listSessions(user.tenantId, { status, search });
  }

  // GET /v1/online-chat/sessions/:id/messages
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('chat', 'read')
  @Get('online-chat/sessions/:id/messages')
  async getMessages(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') sessionId: string,
  ) {
    return this.chat.getMessages(user.tenantId, sessionId);
  }
    // DELETE /v1/online-chat/sessions/:id
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('chat', 'write')
  @Delete('online-chat/sessions/:id')
  async deleteSession(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') sessionId: string,
  ) {
    await this.chat.deleteSession(user.tenantId, sessionId);
    return { ok: true };
  }

  // POST /v1/online-chat/sessions/:id/messages
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('chat', 'write')
  @Post('online-chat/sessions/:id/messages')
  async sendStaffMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') sessionId: string,
    @Body() dto: SendChatMessageDto,
  ) {
    return this.chat.sendStaffMessage(
      user.tenantId,
      user.userId,
      sessionId,
      dto,
    );
  }

  // DEBUG: /v1/online-chat/debug/current-user
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('chat', 'read')
  @Get('online-chat/debug/current-user')
  async debugCurrentUser(@CurrentUser() user: CurrentUserPayload) {
    this.logger.debug(
      `debug/current-user: ${JSON.stringify(user || {})}`,
    );
    return user || {};
  }

  // DEBUG: /v1/online-chat/debug/sessions-current
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('chat', 'read')
  @Get('online-chat/debug/sessions-current')
  async debugSessionsCurrent(@CurrentUser() user: CurrentUserPayload) {
    if (!user?.tenantId) return [];
    return this.chat.listSessions(user.tenantId, {});
  }
}