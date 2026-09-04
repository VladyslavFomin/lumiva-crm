import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { WhatsappWebhookService } from './whatsapp-webhook.service';

/**
 * Публичные эндпоинты Meta WhatsApp Cloud API (без JWT).
 * URL для Meta: GET/POST /v1/webhooks/whatsapp/:connectionId
 */
@SkipThrottle()
@Controller('webhooks/whatsapp')
export class WhatsappWebhookController {
  private readonly log = new Logger(WhatsappWebhookController.name);

  constructor(private readonly svc: WhatsappWebhookService) {}

  @Get(':connectionId')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async verify(
    @Param('connectionId') connectionId: string,
    @Query() query: Record<string, string | string[] | undefined>,
  ): Promise<string> {
    try {
      return await this.svc.verifyAndReturnChallenge(connectionId, query);
    } catch (e) {
      this.log.warn(`WhatsApp verify failed: ${(e as Error).message}`);
      throw new BadRequestException('Verification failed');
    }
  }

  @Post(':connectionId')
  async receive(
    @Param('connectionId') connectionId: string,
    @Body() body: unknown,
  ): Promise<{ ok: true }> {
    // Fire-and-forget (как у Telegram-вебхука) — раньше ждали полную обработку (запись в БД +
    // создание лида + заметка) перед ответом. Meta ретраит вебхук при медленном/неудачном
    // ответе, а неуникальный check-then-insert по waMessageId/waPhoneDigits именно в этом окне
    // мог задвоить сообщение/контакт/лида. Немедленный ok закрывает окно гонки в источнике.
    this.svc.handleInbound(connectionId, body)
      .catch((e) => this.log.error((e as Error).stack || (e as Error).message));
    return { ok: true };
  }
}
