// src/telegram-crm/telegram-crm-public.controller.ts
import { Body, Controller, Headers, Logger, Param, Post } from '@nestjs/common';
import { TelegramCrmService } from './telegram-crm.service';

/**
 * Telegram Bot API updates (без JWT). URL: POST /v1/telegram-crm/webhook/:botId
 * Старые URL с bot token в path тоже поддерживаются для плавной миграции.
 */
@Controller('telegram-crm')
export class TelegramCrmPublicController {
  private readonly log = new Logger(TelegramCrmPublicController.name);

  constructor(private readonly telegramCrmService: TelegramCrmService) {}

  @Post('webhook/:webhookKey')
  async handleWebhook(
    @Param('webhookKey') webhookKey: string,
    @Headers('x-telegram-bot-api-secret-token') secretToken: string | undefined,
    @Body() update: unknown,
  ): Promise<{ ok: true }> {
    const bot = await this.telegramCrmService.findBotByWebhookKey(webhookKey);
    if (!bot) {
      this.log.warn('Telegram webhook: bot not found');
      return { ok: true };
    }
    if (!this.telegramCrmService.isWebhookRequestAuthorized(bot, secretToken)) {
      this.log.warn(`Telegram webhook: secret mismatch for bot ${bot.id}`);
      return { ok: true };
    }
    // Fire-and-forget: return ok immediately so Telegram doesn't time out waiting for AI
    this.telegramCrmService.handleIncomingMessage(bot.tenantId, bot.botToken, update)
      .catch((e) => this.log.error((e as Error).stack || (e as Error).message));
    return { ok: true };
  }
}
