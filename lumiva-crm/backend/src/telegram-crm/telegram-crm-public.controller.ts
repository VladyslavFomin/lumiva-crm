// src/telegram-crm/telegram-crm-public.controller.ts
import { Body, Controller, Logger, Param, Post } from '@nestjs/common';
import { TelegramCrmService } from './telegram-crm.service';

/**
 * Telegram Bot API updates (без JWT). URL: POST /v1/telegram-crm/webhook/:botToken
 */
@Controller('telegram-crm')
export class TelegramCrmPublicController {
  private readonly log = new Logger(TelegramCrmPublicController.name);

  constructor(private readonly telegramCrmService: TelegramCrmService) {}

  @Post('webhook/:botToken')
  async handleWebhook(
    @Param('botToken') botToken: string,
    @Body() update: unknown,
  ): Promise<{ ok: true }> {
    const bot = await this.telegramCrmService.findBotByToken(botToken);
    if (!bot) {
      this.log.warn('Telegram webhook: bot token not found');
      return { ok: true };
    }
    try {
      await this.telegramCrmService.handleIncomingMessage(
        bot.tenantId,
        botToken,
        update,
      );
    } catch (e) {
      this.log.error((e as Error).stack || (e as Error).message);
    }
    return { ok: true };
  }
}
