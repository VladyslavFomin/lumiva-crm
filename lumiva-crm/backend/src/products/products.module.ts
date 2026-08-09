import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { ProductCategory } from './product-category.entity';
import { ProductFieldDef } from './product-field-def.entity';
import { ProductAttribute } from './product-attribute.entity';
import { ProductVariant } from './product-variant.entity';
import { ProductStockMovement } from './product-stock-movement.entity';
import { ProductImportSession } from './product-import-session.entity';
import { ProductChangeLog } from './product-change-log.entity';
import { ProductLocation } from './product-location.entity';
import { ProductLocationStock } from './product-location-stock.entity';
import { ProductWebhook } from './product-webhook.entity';
import { ProductWebhookDelivery } from './product-webhook-delivery.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductsPublicController } from './products-public.controller';
import { ProductsPublicCatalogController } from './products-public-catalog.controller';
import { ProductsPublicOrdersController } from './products-public-orders.controller';
import { ProductsFeedController } from './products-feed.controller';
import { ProductWebhooksController } from './product-webhooks.controller';
import { ProductWebhooksService } from './product-webhooks.service';
import { ProductsAnalyticsController } from './product-analytics.controller';
import { ProductsAnalyticsService } from './product-analytics.service';
import { AnalyticsPreset } from '../sales/sales-analytics-preset.entity';
import { ApiTokensModule } from '../api-tokens/api-tokens.module';
import { ApiTokenGuard } from '../api-tokens/api-token.guard';
import { StaffUser } from '../staff/staff-user.entity';
import { User } from '../users/user.entity';
import { Tenant } from '../tenants/tenant.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { RbacModule } from '../rbac/rbac.module';
import { SitesModule } from '../sites/sites.module';
import { AutomationsModule } from '../automations/automations.module';
import { SalesModule } from '../sales/sales.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductCategory,
      ProductFieldDef,
      ProductAttribute,
      ProductVariant,
      ProductStockMovement,
      ProductImportSession,
      ProductChangeLog,
      ProductLocation,
      ProductLocationStock,
      ProductWebhook,
      ProductWebhookDelivery,
      StaffUser,
      User,
      Tenant,
      // Общая таблица analytics_presets (уже используется sales/*, scope='sales') — здесь
      // регистрируем тот же TypeORM-энтити под scope='products', миграция не нужна (см.
      // ProductsAnalyticsService).
      AnalyticsPreset,
    ]),
    ApiTokensModule,
    NotificationsModule,
    RbacModule,
    SitesModule,
    AutomationsModule,
    SalesModule,
  ],
  controllers: [
    // ВАЖНО: ProductWebhooksController и ProductsAnalyticsController — раньше ProductsController.
    // NestJS/Express матчит маршруты в порядке регистрации контроллеров по модулю, а не по
    // специфичности пути — иначе GET /products/webhooks... или GET /products/analytics... попадёт
    // в ProductsController@:id ("webhooks"/"analytics" как uuid) и упадёт на ParseUUIDPipe
    // ("Validation failed (uuid is expected)"). Тот же принцип, что уже соблюдён внутри самого
    // ProductsController (см. комментарии там про stock/import/export "перед :id").
    ProductWebhooksController,
    ProductsAnalyticsController,
    ProductsController,
    ProductsPublicController,
    ProductsPublicCatalogController,
    ProductsPublicOrdersController,
    ProductsFeedController,
  ],
  providers: [ProductsService, ApiTokenGuard, ProductWebhooksService, ProductsAnalyticsService],
  exports: [ProductsService],
})
export class ProductsModule {}
