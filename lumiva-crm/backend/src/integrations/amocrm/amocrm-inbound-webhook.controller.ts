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
import { AmocrmInboundWebhookService } from './amocrm-inbound-webhook.service';

/**
 * Входящие вебхуки amoCRM (x-www-form-urlencoded или JSON), без JWT.
 * URL: POST /v1/webhooks/amocrm/:connectionId?secret=… (секрет опционален, но рекомендуется).
 */
@SkipThrottle()
@Controller('webhooks/amocrm')
export class AmocrmInboundWebhookController {
  private readonly log = new Logger(AmocrmInboundWebhookController.name);

  constructor(private readonly svc: AmocrmInboundWebhookService) {}

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
