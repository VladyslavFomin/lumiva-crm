// src/telephony/telephony-webhook.controller.ts
import { Body, Controller, Headers, Logger, Param, Post, Query, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { TelephonyService } from './telephony.service';

const FORBIDDEN_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>';

/**
 * Публичные эндпоинты Twilio Voice (без JWT). Подлинность каждого запроса проверяется по
 * X-Twilio-Signature с Auth Token тенанта — так же, как у входящих SMS.
 * URL для консоли/номера Twilio:
 *   Inbound: POST /v1/webhooks/telephony/inbound/:tenantId
 *   Status:  POST /v1/webhooks/telephony/status/:tenantId
 * URL, который сам генерирует TelephonyService при исходящем звонке:
 *   Connect:   POST /v1/webhooks/telephony/connect/:tenantId?to=...&leadId=...
 *   Recording: POST /v1/webhooks/telephony/recording/:tenantId
 */
@SkipThrottle()
@Controller('webhooks/telephony')
export class TelephonyWebhookController {
  private readonly log = new Logger(TelephonyWebhookController.name);

  constructor(private readonly telephony: TelephonyService) {}

  private publicUrl(tenantId: string, suffix: string, query = ''): string {
    const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    return `${base}/v1/webhooks/telephony/${suffix}/${tenantId}${query}`;
  }

  private async verify(
    tenantId: string,
    fullUrl: string,
    body: Record<string, string>,
    signature: string | undefined,
    res: Response,
  ): Promise<boolean> {
    const ok = await this.telephony.verifyWebhookSignature(tenantId, fullUrl, body || {}, signature || '');
    if (!ok) {
      this.log.warn(`Telephony webhook: signature mismatch for tenant ${tenantId}`);
      res.status(403).type('text/xml').send(FORBIDDEN_TWIML);
    }
    return ok;
  }

  @Post('inbound/:tenantId')
  async inbound(
    @Param('tenantId') tenantId: string,
    @Body() body: Record<string, string>,
    @Headers('x-twilio-signature') signature: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const url = this.publicUrl(tenantId, 'inbound');
    if (!(await this.verify(tenantId, url, body, signature, res))) return;
    try {
      await this.telephony.recordInboundCall(tenantId, body);
    } catch (e) {
      this.log.error((e as Error).stack || (e as Error).message);
    }
    const twiml = await this.telephony.inboundTwiml(tenantId);
    res.status(200).type('text/xml').send(twiml);
  }

  @Post('connect/:tenantId')
  async connect(
    @Param('tenantId') tenantId: string,
    @Query('to') to: string,
    @Query('leadId') leadId: string | undefined,
    @Body() body: Record<string, string>,
    @Headers('x-twilio-signature') signature: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const url = this.publicUrl(tenantId, 'connect', `?to=${encodeURIComponent(to || '')}${leadId ? `&leadId=${encodeURIComponent(leadId)}` : ''}`);
    if (!(await this.verify(tenantId, url, body, signature, res))) return;
    const twiml = this.telephony.connectLegTwiml(tenantId, to || '');
    res.status(200).type('text/xml').send(twiml);
  }

  @Post('status/:tenantId')
  async status(
    @Param('tenantId') tenantId: string,
    @Body() body: Record<string, string>,
    @Headers('x-twilio-signature') signature: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const url = this.publicUrl(tenantId, 'status');
    if (!(await this.verify(tenantId, url, body, signature, res))) return;
    try {
      await this.telephony.handleStatusCallback(tenantId, body);
    } catch (e) {
      this.log.error((e as Error).stack || (e as Error).message);
    }
    res.status(200).send('');
  }

  @Post('recording/:tenantId')
  async recording(
    @Param('tenantId') tenantId: string,
    @Body() body: Record<string, string>,
    @Headers('x-twilio-signature') signature: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const url = this.publicUrl(tenantId, 'recording');
    if (!(await this.verify(tenantId, url, body, signature, res))) return;
    try {
      await this.telephony.handleRecordingCallback(tenantId, body);
    } catch (e) {
      this.log.error((e as Error).stack || (e as Error).message);
    }
    res.status(200).send('');
  }
}
