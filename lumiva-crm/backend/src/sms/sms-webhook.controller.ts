// src/sms/sms-webhook.controller.ts
import { Body, Controller, Headers, Logger, Param, Post, Req, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { SmsService } from './sms.service';

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

/**
 * Публичный эндпоинт для входящих SMS от Twilio (без JWT).
 * URL для консоли Twilio: POST /v1/webhooks/sms/twilio/:tenantId
 * Подлинность проверяется по X-Twilio-Signature с Auth Token тенанта — не по URL/tenantId.
 */
@SkipThrottle()
@Controller('webhooks/sms')
export class SmsWebhookController {
  private readonly log = new Logger(SmsWebhookController.name);

  constructor(private readonly smsService: SmsService) {}

  @Post('twilio/:tenantId')
  async receiveTwilio(
    @Param('tenantId') tenantId: string,
    @Body() body: Record<string, string>,
    @Headers('x-twilio-signature') signature: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    const publicUrl = `${base}/v1/webhooks/sms/twilio/${tenantId}`;
    try {
      const result = await this.smsService.recordInboundTwilio(tenantId, publicUrl, body || {}, signature || '');
      if (!result.accepted) {
        this.log.warn(`Twilio inbound SMS rejected for tenant ${tenantId}: ${result.reason}`);
        res.status(403).send('Forbidden');
        return;
      }
    } catch (e) {
      this.log.error((e as Error).stack || (e as Error).message);
    }
    res.status(200).type('text/xml').send(EMPTY_TWIML);
  }
}
