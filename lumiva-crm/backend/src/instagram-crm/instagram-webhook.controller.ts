import { BadRequestException, Body, Controller, Get, Header, Headers, HttpCode, Logger, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InstagramCrmService } from './instagram-crm.service';

/**
 * Вебхук Instagram платформенного Meta-приложения (один на всех тенантов, маршрутизация по entry.id).
 * URL для Meta: GET/POST /v1/webhooks/instagram
 */
@SkipThrottle()
@Controller('webhooks/instagram')
export class InstagramWebhookController {
  private readonly log = new Logger(InstagramWebhookController.name);

  constructor(private readonly svc: InstagramCrmService) {}

  @Get()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  verify(@Query() q: Record<string, string | undefined>): string {
    if (q['hub.mode'] !== 'subscribe' || !q['hub.challenge'] || q['hub.verify_token'] !== this.svc.webhookVerifyToken()) {
      throw new BadRequestException('Verification failed');
    }
    return String(q['hub.challenge']);
  }

  @Post()
  @HttpCode(200)
  async receive(
    @Body() body: unknown,
    @Req() req: { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature: string | undefined,
  ): Promise<{ ok: true }> {
    if (!(await this.svc.verifySignature(req.rawBody, signature))) {
      this.log.warn('Instagram webhook: invalid or missing X-Hub-Signature-256, ignored');
      throw new UnauthorizedException('Invalid signature');
    }
    // как у WhatsApp: отвечаем сразу, иначе Meta ретраит и окно гонки дублей шире
    this.svc.handleWebhook(body).catch((e) => this.log.error((e as Error).stack || (e as Error).message));
    return { ok: true };
  }
}
