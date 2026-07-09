// src/integrations/shopify/shopify-inbound.controller.ts
import { Body, Controller, Headers, Logger, Param, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ShopifyInboundService } from './shopify-inbound.service';

/**
 * Inbound webhooks from Shopify → CRM.
 * URL: POST /v1/webhooks/shopify/:connectionId
 *
 * Shopify sends:
 *  - X-Shopify-Topic header  (e.g. "orders/create")
 *  - X-Shopify-Hmac-SHA256 header (HMAC-SHA256 base64 of raw body)
 *  - JSON body
 */
@SkipThrottle()
@Controller('webhooks/shopify')
export class ShopifyInboundController {
  private readonly log = new Logger(ShopifyInboundController.name);

  constructor(private readonly svc: ShopifyInboundService) {}

  @Post(':connectionId')
  async receive(
    @Param('connectionId') connectionId: string,
    @Headers('x-shopify-topic') topic: string,
    @Headers('x-shopify-hmac-sha256') hmac: string | undefined,
    @Body() body: any,
  ): Promise<{ ok: true }> {
    try {
      return await this.svc.receive(connectionId, topic, body, hmac);
    } catch (e) {
      this.log.error((e as Error).stack || (e as Error).message);
      // Return 200 to prevent Shopify from retrying on auth errors
      return { ok: true };
    }
  }
}
