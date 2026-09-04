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
    return this.telegramCrmService.findAllBotsPublic(user.tenantId);
  }

  @Get('bots/:id')
  @RequirePermission('telegram', 'read')
  async findBot(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.telegramCrmService.findBotPublic(user.tenantId, id);
  }

  @Post('bots/preview')
  @RequirePermission('telegram', 'write')
  async previewBotToken(@Body() body: { botToken: string }) {
    return this.telegramCrmService.previewBotToken(body.botToken);
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
    @Body() body: {
      botToken?: string; botName?: string; botUsername?: string; webhookUrl?: string;
      welcomeMessage?: string; isActive?: boolean; autoReply?: boolean;
      meta?: { aiConnector?: Record<string, any>; capabilities?: Record<string, boolean>; crmLink?: Record<string, any> };
    },
  ) {
    return this.telegramCrmService.updateBot(
      user.tenantId,
      id,
      body,
    );
  }

  // ==== FLOWS ====

  @Get('bots/:id/flows')
  @RequirePermission('telegram', 'read')
  async getFlows(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.telegramCrmService.getFlows(user.tenantId, id);
  }

  @Post('bots/:id/flows')
  @RequirePermission('telegram', 'write')
  async saveFlow(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() flow: any) {
    const flows = await this.telegramCrmService.saveFlow(user.tenantId, id, flow);
    return { flows };
  }

  @Delete('bots/:id/flows/:flowId')
  @RequirePermission('telegram', 'write')
  async deleteFlow(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Param('flowId') flowId: string) {
    const flows = await this.telegramCrmService.deleteFlow(user.tenantId, id, flowId);
    return { flows };
  }

  @Post('bots/:id/flows/:flowId/activate')
  @RequirePermission('telegram', 'write')
  async activateFlow(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Param('flowId') flowId: string) {
    return this.telegramCrmService.setActiveFlow(user.tenantId, id, flowId);
  }

  @Post('bots/:id/flows/deactivate')
  @RequirePermission('telegram', 'write')
  async deactivateFlow(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.telegramCrmService.setActiveFlow(user.tenantId, id, null);
  }

  @Get('bots/:id/flow-stats')
  @RequirePermission('telegram', 'read')
  async getFlowStats(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Query('flowId') flowId: string) {
    return this.telegramCrmService.getFlowStats(user.tenantId, id, flowId);
  }

  @Get('bots/:id/funnel')
  @RequirePermission('telegram', 'read')
  async getFunnel(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.telegramCrmService.getFunnelSummary(user.tenantId, id);
  }

  // ==== AI CONNECTOR ====

  @Post('bots/:id/ai/test-chat')
  @RequirePermission('telegram', 'read')
  async testChat(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { history: Array<{ role: 'user' | 'assistant'; text: string }>; message: string },
  ) {
    return this.telegramCrmService.sendTestMessage(user.tenantId, id, body);
  }

  // ==== SETTINGS: webhook diagnostics, commands, event log ====

  @Get('bots/:id/webhook-info')
  @RequirePermission('telegram', 'read')
  async getWebhookInfo(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.telegramCrmService.getWebhookInfo(user.tenantId, id);
  }

  @Post('bots/:id/commands')
  @RequirePermission('telegram', 'write')
  async setCommands(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { commands: Array<{ command: string; description: string; targetNodeId?: string }> },
  ) {
    return this.telegramCrmService.setCommands(user.tenantId, id, body.commands || []);
  }

  @Get('bots/:id/log')
  @RequirePermission('telegram', 'read')
  async getLog(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Query('kind') kind?: string) {
    return this.telegramCrmService.getEventLog(user.tenantId, id, kind);
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
    await this.telegramCrmService.deleteBot(user.tenantId, id);
    return { success: true };
  }

  // ==== BOT RECIPIENTS ====

  @Get('bots/:id/recipients')
  @RequirePermission('telegram', 'read')
  async getBotRecipients(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.telegramCrmService.getBotRecipients(user.tenantId, id);
  }

  @Post('bots/:id/recipients')
  @RequirePermission('telegram', 'write')
  async addBotRecipient(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { staffUserId: string; staffUserName: string; telegramChatId: string; telegramUsername?: string },
  ) {
    return this.telegramCrmService.addBotRecipient(user.tenantId, id, body);
  }

  @Delete('bots/:id/recipients/:recipientId')
  @RequirePermission('telegram', 'write')
  async removeBotRecipient(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('recipientId') recipientId: string,
  ) {
    await this.telegramCrmService.removeBotRecipient(user.tenantId, id, recipientId);
    return { success: true };
  }

  // ==== INBOX (conversation list) ====
  @Get('contacts')
  @RequirePermission('telegram', 'read')
  async findContacts(
    @CurrentUser() user: CurrentUserPayload,
    @Query('search') search?: string,
    @Query('botId') botId?: string,
  ) {
    return this.telegramCrmService.findContacts(user.tenantId, { search, botId });
  }

  @Post('contacts/:id/read')
  @RequirePermission('telegram', 'read')
  async markContactRead(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.telegramCrmService.markContactMessagesRead(user.tenantId, id);
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
}

