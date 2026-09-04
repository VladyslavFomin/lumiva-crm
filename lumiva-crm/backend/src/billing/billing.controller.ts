import { Body, Controller, Get, Headers, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { getClientIp } from '../common/client-ip.util';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('catalog')
  async catalog() {
    return this.billing.getCatalog();
  }

  @Get('plan-features')
  async planFeatures() {
    return this.billing.getPlanFeatureUnlocks();
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout-ai-addon')
  async createAiAddon(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      kind: 'ai_prepaid' | 'storage_pack' | 'telephony_addon';
      successUrl: string;
      cancelUrl: string;
    },
  ) {
    return this.billing.createAiAddonCheckoutSession({
      tenantId: user?.tenantId,
      kind: body.kind,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout-session')
  async createCheckout(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Body()
    body: {
      plan: 'standard' | 'professional' | 'enterprise' | 'ultimate';
      period?: 'month' | 'year';
      successUrl: string;
      cancelUrl: string;
    },
  ) {
    return this.billing.createCheckoutSession({
      tenantId: user?.tenantId,
      plan: body.plan,
      period: body.period || 'month',
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
      ip: getClientIp(req) || undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('portal-session')
  async createPortal(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { returnUrl: string },
  ) {
    return this.billing.createPortalSession({
      tenantId: user?.tenantId,
      returnUrl: body.returnUrl,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('checkout-confirm')
  async confirm(
    @CurrentUser() user: CurrentUserPayload,
    @Query('session_id') sessionId?: string,
    @Query('provider') provider?: string,
    @Query('ref') ref?: string,
  ) {
    if (!provider || provider === 'stripe') {
      if (!sessionId) return { ok: false, message: 'session_id is required' };
      return this.billing.confirmCheckoutSession({
        tenantId: user?.tenantId,
        sessionId,
      });
    }
    if (provider === 'yookassa') {
      if (!ref) return { ok: false, message: 'ref is required' };
      return this.billing.confirmYookassaCheckout({
        tenantId: user?.tenantId,
        paymentId: ref,
      });
    }
    return { ok: false, message: 'Unsupported provider' };
  }

  @Post('stripe/webhook')
  async webhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('stripe-signature') signature?: string,
  ) {
    const rawBody = (req as any).rawBody as Buffer | undefined;
    const payload = rawBody || Buffer.from(JSON.stringify(req.body || {}));
    await this.billing.handleStripeEvent(payload, signature);
    return res.json({ received: true });
  }

  /**
   * Webhook ЮKassa для платформенного биллинга тарифа. Телу не доверяем (у ЮKassa нет
   * встроенной подписи по умолчанию) — сервис перезапрашивает статус по id платежа.
   * Отвечаем 200 на любой исход, иначе ЮKassa будет повторять запрос.
   */
  @Post('yookassa/webhook')
  async yookassaWebhook(
    @Body() body: { event?: string; object?: { id?: string } },
    @Res() res: Response,
  ) {
    try {
      await this.billing.handleYookassaWebhook(body);
    } catch {
      // swallow — see payments.controller.ts's yookassaCallback for why we still answer 200
    }
    res.status(200).send('');
  }

  /**
   * Публичный callback iyzico для платформенного биллинга тарифа: iyzico делает redirect
   * сюда после оплаты с полем token в теле формы. Мы всегда перепроверяем статус на сервере,
   * а не доверяем содержимому запроса.
   */
  @Post('iyzico/callback')
  async iyzicoCallback(@Body() body: { token?: string }, @Res() res: Response) {
    const frontend = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const token = body?.token?.trim();
    if (!token) {
      return res.redirect(`${frontend}/app/billing?provider=iyzico&status=failed`);
    }
    try {
      const r = await this.billing.handleIyzicoCallback(token);
      return res.redirect(`${frontend}/app/billing?provider=iyzico&status=${r.status}`);
    } catch {
      return res.redirect(`${frontend}/app/billing?provider=iyzico&status=failed`);
    }
  }
}
