// src/integrations/woocommerce/woocommerce-inbound.controller.ts
import { Body, Controller, Headers, Logger, Param, Post, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { WooCommerceInboundService } from './woocommerce-inbound.service';

/**
 * Inbound webhooks from WooCommerce → CRM.
 * URL: POST /v1/webhooks/woocommerce/:connectionId
 *      Optional: ?secret=<webhookSecret> for simple auth
 *
 * WooCommerce sends:
 *  - X-WC-Webhook-Topic header  (e.g. "order.created")
 *  - X-WC-Webhook-Signature header (HMAC-SHA256 base64 of raw body using webhookSecret)
 *  - JSON body
 */
@SkipThrottle()
@Controller('webhooks/woocommerce')
export class WooCommerceInboundController {
  private readonly log = new Logger(WooCommerceInboundController.name);

  constructor(private readonly svc: WooCommerceInboundService) {}

  @Post(':connectionId')
  async receive(
    @Param('connectionId') connectionId: string,
    @Query('secret') secret: string | undefined,
    @Headers('x-wc-webhook-topic') topic: string | undefined,
    @Headers('x-wc-webhook-signature') signature: string | undefined,
    @Body() body: any,
  ): Promise<{ ok: true }> {
    try {
      return await this.svc.receive(connectionId, secret, topic, signature, body);
    } catch (e) {
      this.log.error((e as Error).stack || (e as Error).message);
      return { ok: true };
    }
  }
}
