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
import { WordpressCf7InboundWebhookService } from './wordpress-cf7-inbound-webhook.service';

/**
 * Входящие заявки с сайта (WordPress Contact Form 7 и аналоги), без JWT.
 * URL: POST /v1/webhooks/site-forms/:connectionId?secret=…
 */
@SkipThrottle()
@Controller('webhooks/site-forms')
export class WordpressCf7InboundWebhookController {
  private readonly log = new Logger(WordpressCf7InboundWebhookController.name);

  constructor(private readonly svc: WordpressCf7InboundWebhookService) {}

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
