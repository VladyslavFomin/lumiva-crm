// src/telegram-crm/telegram-crm.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TelegramCrmService } from './telegram-crm.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';

@Controller('telegram-crm')
@UseGuards(JwtAuthGuard, RbacGuard)
export class TelegramCrmController {
  constructor(private readonly telegramCrmService: TelegramCrmService) {}

  // ==== BOTS ====
  @Get('bots')
  @RequirePermission('telegram', 'read')
  async findAllBots(@CurrentUser() user: CurrentUserPayload) {
    return this.telegramCrmService.findAllBots(user.tenantId);
  }

  @Get('bots/:id')
  @RequirePermission('telegram', 'read')
  async findBot(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.telegramCrmService.findBot(user.tenantId, id);
  }

  @Post('bots')
  @RequirePermission('telegram', 'write')
  async createBot(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { botToken: string; webhookUrl?: string },
  ) {
    return this.telegramCrmService.createBot(
      user.tenantId,
      body.botToken,
      body.webhookUrl,
    );
  }

  @Patch('bots/:id')
  @RequirePermission('telegram', 'write')
  async updateBot(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { botToken?: string; botName?: string; botUsername?: string; webhookUrl?: string; welcomeMessage?: string; isActive?: boolean },
  ) {
    return this.telegramCrmService.updateBot(
      user.tenantId,
      id,
      body,
    );
  }

  @Post('bots/:id/webhook')
  @RequirePermission('telegram', 'write')
  async setWebhook(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { webhookUrl: string },
  ) {
    await this.telegramCrmService.setWebhook(
      user.tenantId,
      id,
      body.webhookUrl,
    );
    return { success: true };
  }

  @Delete('bots/:id')
  @RequirePermission('telegram', 'delete')
  async deleteBot(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    // TODO: удаление бота
    return { success: true };
  }

  // ==== MESSAGES ====
  @Get('messages')
  @RequirePermission('telegram', 'read')
  async findMessages(
    @CurrentUser() user: CurrentUserPayload,
    @Query('contactId') contactId?: string,
    @Query('telegramUserId') telegramUserId?: string,
    @Query('direction') direction?: 'incoming' | 'outgoing',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.telegramCrmService.findMessages(user.tenantId, {
      contactId,
      telegramUserId,
      direction,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post('send')
  @RequirePermission('telegram', 'write')
  async sendMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: {
      botId: string;
      telegramUserId: string;
      text: string;
      contactId?: string;
      companyId?: string;
      leadId?: string;
      saleId?: string;
    },
  ) {
    return this.telegramCrmService.sendMessage(
      user.tenantId,
      body.botId,
      body.telegramUserId,
      body.text,
      {
        contactId: body.contactId,
        companyId: body.companyId,
        leadId: body.leadId,
        saleId: body.saleId,
      },
    );
  }

  // ==== WEBHOOK (публичный, без аутентификации) ====
  @Post('webhook/:botToken')
  async handleWebhook(
    @Param('botToken') botToken: string,
    @Body() update: any,
  ) {
    const bot = await this.telegramCrmService.findBotByToken(botToken);

    if (!bot) {
      return { ok: false, error: 'Bot not found' };
    }

    await this.telegramCrmService.handleIncomingMessage(
      bot.tenantId,
      botToken,
      update,
    );

    return { ok: true };
  }
}

