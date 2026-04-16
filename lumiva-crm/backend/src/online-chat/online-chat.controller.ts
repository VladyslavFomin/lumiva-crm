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
} from '@nestjs/common';

import { OnlineChatService } from './online-chat.service';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.interface';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SendChatMessageDto } from './dto/send-chat-message.dto';

@Controller()
export class OnlineChatController {
  private readonly logger = new Logger(OnlineChatController.name);

  constructor(private readonly chat: OnlineChatService) {}

  /* ============================================================
   * 1. STAFF API — CRM панель (требует JWT)
   * Итоговый путь: /v1/online-chat/...
   * ==========================================================*/

  // GET /v1/online-chat/sessions
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  @Get('online-chat/sessions/:id/messages')
  async getMessages(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') sessionId: string,
  ) {
    return this.chat.getMessages(user.tenantId, sessionId);
  }
    // DELETE /v1/online-chat/sessions/:id
  @UseGuards(JwtAuthGuard)
  @Delete('online-chat/sessions/:id')
  async deleteSession(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') sessionId: string,
  ) {
    await this.chat.deleteSession(user.tenantId, sessionId);
    return { ok: true };
  }

  // POST /v1/online-chat/sessions/:id/messages
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  @Get('online-chat/debug/current-user')
  async debugCurrentUser(@CurrentUser() user: CurrentUserPayload) {
    this.logger.debug(
      `debug/current-user: ${JSON.stringify(user || {})}`,
    );
    return user || {};
  }

  // DEBUG: /v1/online-chat/debug/sessions-current
  @UseGuards(JwtAuthGuard)
  @Get('online-chat/debug/sessions-current')
  async debugSessionsCurrent(@CurrentUser() user: CurrentUserPayload) {
    if (!user?.tenantId) return [];
    return this.chat.listSessions(user.tenantId, {});
  }

  /* ============================================================
   * 2. DEBUG по tenantKey (без авторизации)
   * Итоговый путь: /v1/online-chat/debug-sessions?tenantKey=xxxx
   * ==========================================================*/

  @Get('online-chat/debug-sessions')
  async debugSessions(@Query('tenantKey') tenantKey: string) {
    return this.chat.debugListByTenantKey(tenantKey);
  }
}