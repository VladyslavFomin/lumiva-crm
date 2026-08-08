// src/products/product-analytics.controller.ts
import { Body, Controller, Get, Patch, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { ProductsAnalyticsService } from './product-analytics.service';
import { ProductsAnalyticsQueryDto } from './dto/products-analytics-query.dto';
import { SaveProductsAnalyticsPresetDto } from './dto/save-products-analytics-preset.dto';

// ВАЖНО: этот контроллер должен быть зарегистрирован в products.module.ts РАНЬШЕ
// ProductsController — иначе GET /products/analytics попадёт в ProductsController@:id
// (см. подробный комментарий про этот же баг с ProductWebhooksController в products.module.ts).
@Controller('products/analytics')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('products', 'read')
export class ProductsAnalyticsController {
  constructor(private readonly service: ProductsAnalyticsService) {}

  @Get()
  getAnalytics(@CurrentUser() user: CurrentUserPayload, @Query() query: ProductsAnalyticsQueryDto) {
    return this.service.getAnalytics(user.tenantId, query);
  }

  @Get('export')
  async exportAnalytics(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ProductsAnalyticsQueryDto,
    @Res() res: Response,
  ) {
    const { buffer, filename, contentType } = await this.service.exportAnalytics(user.tenantId, query);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('preset')
  getPreset(@CurrentUser() user: CurrentUserPayload) {
    const userId = user.userId || user.id || user.sub || null;
    return this.service.getPreset(user.tenantId, userId);
  }

  @Patch('preset')
  savePreset(@CurrentUser() user: CurrentUserPayload, @Body() dto: SaveProductsAnalyticsPresetDto) {
    const userId = user.userId || user.id || user.sub || null;
    return this.service.savePreset(user.tenantId, userId, dto);
  }
}
