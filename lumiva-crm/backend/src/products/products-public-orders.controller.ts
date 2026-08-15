import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ProductsService } from './products.service';
import { SalesService } from '../sales/sales.service';
import { PaymentsService } from '../payments/payments.service';
import { getClientIp } from '../common/client-ip.util';

interface StorefrontOrderItemDto {
  sku: string;
  qty: number;
}

interface CreateStorefrontOrderDto {
  items: StorefrontOrderItemDto[];
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  /** Нужны только если у тенанта подключена оплата картой (iyzico) */
  customerCity?: string;
  customerAddress?: string;
}

/**
 * Оформление заказа из тестовой публичной витрины (см. lumiva_pl1_platform_admin.md / текущий
 * план "Test storefront"). Живёт рядом с `ProductsPublicCatalogController`, но не в нём — этот
 * контроллер также зависит от SalesService (создание Sale), а каталог — только от ProductsService.
 * Цена всегда берётся из каталога на сервере, а не из тела запроса — витрина не должна доверять
 * клиенту сумму заказа.
 */
@Controller('public/catalog')
export class ProductsPublicOrdersController {
  constructor(
    private readonly products: ProductsService,
    private readonly sales: SalesService,
    private readonly payments: PaymentsService,
  ) {}

  @Post(':clientKey/orders')
  async createOrder(
    @Param('clientKey') clientKey: string,
    @Body() dto: CreateStorefrontOrderDto,
    @Req() req: Request,
  ) {
    if (!dto?.items?.length) throw new BadRequestException('Корзина пуста');
    if (!dto.customerName?.trim()) throw new BadRequestException('Укажите имя');

    const tenantId = await this.products.resolvePublicTenantId(clientKey);

    let currency = 'EUR';
    const items = await Promise.all(
      dto.items.map(async (item) => {
        const qty = Math.max(1, Math.trunc(item.qty || 1));
        const { product } = await this.products.getPublicCatalogProduct(clientKey, item.sku);
        currency = product.currency || currency;
        return {
          productId: product.id,
          sku: product.sku || item.sku,
          name: product.name,
          qty,
          unitPrice: Number(product.price) || 0,
        };
      }),
    );

    const sale = await this.sales.createFromStorefront(tenantId, {
      items,
      currency,
      customerName: dto.customerName,
      customerEmail: dto.customerEmail,
      customerPhone: dto.customerPhone,
    });

    let paymentPageUrl: string | null = null;
    const email = dto.customerEmail?.trim();
    const city = dto.customerCity?.trim();
    const address = dto.customerAddress?.trim();
    if (email && city && address) {
      const provider = await this.payments.findEnabledProvider(tenantId);
      if (provider) {
        try {
          const payment = await this.payments.createStorefrontPayment({
            tenantId,
            sale,
            provider,
            buyer: {
              name: dto.customerName.trim(),
              email,
              phone: dto.customerPhone?.trim(),
              city,
              address,
              ip: getClientIp(req) || '0.0.0.0',
            },
            basketItems: items.map((i) => ({
              id: i.productId,
              name: i.name,
              category1: 'Products',
              price: (i.unitPrice * i.qty).toFixed(2),
            })),
          });
          paymentPageUrl = payment.paymentPageUrl;
        } catch {
          // Заказ уже создан; оставляем его неоплаченным, если провайдер недоступен —
          // не блокируем оформление из-за сбоя платёжного шлюза.
          paymentPageUrl = null;
        }
      }
    }

    return {
      orderCode: sale.externalOrderNo,
      total: sale.amount,
      currency: sale.currency,
      items,
      paymentPageUrl,
    };
  }

  @Get(':clientKey/orders/:code')
  async lookupOrder(
    @Param('clientKey') clientKey: string,
    @Param('code') code: string,
    @Query('email') email?: string,
  ) {
    if (!email?.trim()) throw new NotFoundException('Заказ не найден');
    const tenantId = await this.products.resolvePublicTenantId(clientKey);
    const sale = await this.sales.findStorefrontOrder(tenantId, code, email);
    return {
      orderCode: sale.externalOrderNo,
      total: sale.amount,
      currency: sale.currency,
      status: sale.status,
      createdAt: sale.createdAt,
      items: (sale.customFields as any)?.items ?? [],
      customerName: sale.guestName,
    };
  }
}
