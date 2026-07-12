import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ProductsService } from './products.service';

/**
 * Товарные фиды по токену сайта (`Site.apiToken`) — для Google Merchant Center, импорта в
 * WooCommerce и headless-интеграций (см. lumiva_products_module_roadmap.md §15, пункт 2).
 * Токен в пути, а не в заголовке — так фид можно скормить внешнему краулеру напрямую (тот же
 * подход, что у большинства платформ с товарными фидами).
 */
@Controller('public/feeds')
export class ProductsFeedController {
  constructor(private readonly service: ProductsService) {}

  @Get(':siteToken/google.xml')
  async googleXml(@Param('siteToken') siteToken: string, @Res() res: Response) {
    const xml = await this.service.generateGoogleMerchantFeed(siteToken);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  }

  @Get(':siteToken/woocommerce.csv')
  async wooCommerceCsv(@Param('siteToken') siteToken: string, @Res() res: Response) {
    const csv = await this.service.generateWooCommerceFeed(siteToken);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="woocommerce-products.csv"');
    res.send(csv);
  }

  @Get(':siteToken/products.json')
  async json(@Param('siteToken') siteToken: string) {
    return this.service.generateJsonFeed(siteToken);
  }
}
