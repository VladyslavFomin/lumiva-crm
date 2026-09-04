import {
  Body,
  Controller,
  Headers,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { BitrixInboundWebhookService } from './bitrix-inbound-webhook.service';

/**
 * Входящие исходящие вебхуки Bitrix24 (x-www-form-urlencoded), без JWT.
 * URL: POST /v1/webhooks/bitrix/:connectionId?secret=… (секрет опционален, но рекомендуется).
 */
@SkipThrottle()
@Controller('webhooks/bitrix')
export class BitrixInboundWebhookController {
  private readonly log = new Logger(BitrixInboundWebhookController.name);

  constructor(private readonly svc: BitrixInboundWebhookService) {}

  @Post(':connectionId')
  async receive(
    @Param('connectionId') connectionId: string,
    @Query('secret') secret: string | undefined,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
  ): Promise<{ ok: true }> {
    try {
      const query: Record<string, string | string[] | undefined> = {};
      if (secret !== undefined && secret !== null) {
        query.secret = secret;
      }
      await this.svc.handleInbound(connectionId, headers, query, body);
    } catch (e) {
      this.log.error((e as Error).stack || (e as Error).message);
    }
    return { ok: true };
  }
}
