import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

/**
 * Публичная витрина товаров БЕЗ API-токена — для внешнего сайта клиента, который просто хочет
 * вывести каталог (см. lumiva_products_module_roadmap.md §13, решено 2026-07-11). Не путать с
 * `ProductsPublicController` (`/public/products`, под ApiTokenGuard) — там полный список для
 * интеграций с записью; здесь — только то, что явно помечено `isPubliclyVisible` на товаре, и
 * без `costPrice`. Тенант резолвится по `Tenant.clientKey` — тому же публичному идентификатору,
 * что уже показывается клиенту в Настройках → Компания и используется на странице логина.
 */
@Controller('public/catalog')
export class ProductsPublicCatalogController {
  constructor(private readonly service: ProductsService) {}

  @Get(':clientKey/products')
  list(@Param('clientKey') clientKey: string, @Query('site') site?: string) {
    return this.service.listPublicCatalog(clientKey, site);
  }

  @Get(':clientKey/products/:externalIdOrSku')
  getOne(
    @Param('clientKey') clientKey: string,
    @Param('externalIdOrSku') externalIdOrSku: string,
    @Query('site') site?: string,
  ) {
    return this.service.getPublicCatalogProduct(clientKey, externalIdOrSku, site);
  }
}
