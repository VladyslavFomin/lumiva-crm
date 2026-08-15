import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { PaymentsService } from './payments.service';
import { CreateSalePaymentLinkDto } from './dto/create-sale-payment-link.dto';
import type { PaymentDto } from './payment.dto';
import { getClientIp } from '../common/client-ip.util';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly svc: PaymentsService) {}

  /**
   * Выставить счёт на оплату для Sale (iyzico Checkout Form).
   * POST /v1/payments/sales/:saleId/link
   */
  @Post('sales/:saleId/link')
  @UseGuards(JwtAuthGuard)
  async createSalePaymentLink(
    @CurrentUser() user: CurrentUserPayload,
    @Param('saleId') saleId: string,
    @Body() dto: CreateSalePaymentLinkDto,
    @Req() req: Request,
  ): Promise<PaymentDto> {
    return this.svc.createSalePaymentLink(
      user.tenantId,
      saleId,
      dto,
      getClientIp(req) || '0.0.0.0',
    );
  }

  /**
   * Статус платежа (для опроса из модалки «Выставить счёт»).
   * GET /v1/payments/:id
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getPayment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<PaymentDto> {
    return this.svc.getPayment(user.tenantId, id);
  }

  /**
   * Публичный callback iyzico (без авторизации): iyzico делает redirect сюда после оплаты
   * с полем token в теле формы. Мы всегда перепроверяем статус на сервере, а не доверяем
   * содержимому запроса.
   * POST /v1/payments/iyzico/callback
   */
  @Post('iyzico/callback')
  async iyzicoCallback(@Body() body: { token?: string }, @Res() res: Response) {
    const frontend = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const fail = () => res.redirect(`${frontend}/pay/result?status=failed`);
    const token = body?.token?.trim();
    if (!token) return fail();
    try {
      const r = await this.svc.handleIyzicoCallback(token);
      return res.redirect(
        `${frontend}/pay/result?status=${r.status}${r.saleId ? `&sale=${r.saleId}` : ''}`,
      );
    } catch {
      return fail();
    }
  }

  /**
   * Notification (webhook) PayTR — настраивается в панели PayTR (Bildirim URL), не передаётся
   * динамически. Подпись проверяется внутри сервиса. PayTR требует ответ ровно "OK" (не JSON) —
   * иначе будет повторять запрос по расписанию.
   * POST /v1/payments/paytr/callback
   */
  @Post('paytr/callback')
  async paytrCallback(
    @Body() body: { merchant_oid?: string; status?: string; total_amount?: string; hash?: string },
    @Res() res: Response,
  ) {
    try {
      await this.svc.handlePaytrNotification(body);
    } catch {
      // PayTR retries on anything other than "OK" — respond OK regardless so a transient error
      // here doesn't spam retries; the payment simply stays "pending" until support investigates.
    }
    res.status(200).send('OK');
  }

  /**
   * Webhook (HTTP-уведомление) ЮKassa — настраивается в личном кабинете ЮKassa (Интеграция →
   * HTTP-уведомления), не передаётся динамически. Телу не доверяем — сервис перезапрашивает
   * статус по id платежа. Отвечаем 200 на любой исход, иначе ЮKassa будет повторять запрос.
   * POST /v1/payments/yookassa/callback
   */
  @Post('yookassa/callback')
  async yookassaCallback(
    @Body() body: { event?: string; object?: { id?: string } },
    @Res() res: Response,
  ) {
    try {
      await this.svc.handleYookassaNotification(body);
    } catch {
      // swallow — see paytrCallback for why we still answer 200
    }
    res.status(200).send('');
  }
}
