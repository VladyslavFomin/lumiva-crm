// src/integrations/zapier-make/zapier-make-inbound.controller.ts
import { Body, Controller, Headers, Logger, Param, Post, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ZapierMakeInboundService } from './zapier-make-inbound.service';

/**
 * Входящие данные от Zapier / Make (Integromat).
 * URL: POST /v1/webhooks/zapier-make/:connectionId?token=…
 *
 * Payload создаёт лид в CRM с авто-распознаванием полей.
 */
@SkipThrottle()
@Controller('webhooks/zapier-make')
export class ZapierMakeInboundController {
  private readonly log = new Logger(ZapierMakeInboundController.name);

  constructor(private readonly svc: ZapierMakeInboundService) {}

  @Post(':connectionId')
  async receive(
    @Param('connectionId') connectionId: string,
    @Query('token') token: string | undefined,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
  ): Promise<{ ok: true }> {
    try {
      const query: Record<string, string | string[] | undefined> = {};
      if (token) query.token = token;
      await this.svc.handleInbound(connectionId, headers, query, body);
    } catch (e) {
      this.log.error((e as Error).stack || (e as Error).message);
    }
    return { ok: true };
  }
}
