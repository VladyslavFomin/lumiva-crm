import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { SalesService } from '../sales/sales.service';

interface StorefrontOrderItemDto {
  sku: string;
  qty: number;
}

interface CreateStorefrontOrderDto {
  items: StorefrontOrderItemDto[];
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
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
  ) {}

  @Post(':clientKey/orders')
  async createOrder(@Param('clientKey') clientKey: string, @Body() dto: CreateStorefrontOrderDto) {
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

    return {
      orderCode: sale.externalOrderNo,
      total: sale.amount,
      currency: sale.currency,
      items,
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
