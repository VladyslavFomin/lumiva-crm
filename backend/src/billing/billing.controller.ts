import { Body, Controller, Get, Headers, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('catalog')
  async catalog() {
    return this.billing.getCatalog();
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout-session')
  async createCheckout(
    @CurrentUser() user: CurrentUserPayload,
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
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('checkout-confirm')
  async confirm(
    @CurrentUser() user: CurrentUserPayload,
    @Query('session_id') sessionId?: string,
  ) {
    if (!sessionId) return { ok: false, message: 'session_id is required' };
    return this.billing.confirmCheckoutSession({
      tenantId: user?.tenantId,
      sessionId,
    });
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
}
