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
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductsPublicController } from './products-public.controller';
import { ProductsPublicCatalogController } from './products-public-catalog.controller';
import { ProductsFeedController } from './products-feed.controller';
import { ProductWebhooksController } from './product-webhooks.controller';
import { ProductWebhooksService } from './product-webhooks.service';
import { ApiTokensModule } from '../api-tokens/api-tokens.module';
import { ApiTokenGuard } from '../api-tokens/api-token.guard';
import { StaffUser } from '../staff/staff-user.entity';
import { User } from '../users/user.entity';
import { Tenant } from '../tenants/tenant.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { RbacModule } from '../rbac/rbac.module';
import { SitesModule } from '../sites/sites.module';

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
      StaffUser,
      User,
      Tenant,
    ]),
    ApiTokensModule,
    NotificationsModule,
    RbacModule,
    SitesModule,
  ],
  controllers: [
    // ВАЖНО: ProductWebhooksController — раньше ProductsController. NestJS/Express матчит
    // маршруты в порядке регистрации контроллеров по модулю, а не по специфичности пути — иначе
    // GET/DELETE /products/webhooks... попадёт в ProductsController@:id ("webhooks" как uuid) и
    // упадёт на ParseUUIDPipe ("Validation failed (uuid is expected)"). Тот же принцип, что уже
    // соблюдён внутри самого ProductsController (см. комментарии там про stock/import/export
    // "перед :id").
    ProductWebhooksController,
    ProductsController,
    ProductsPublicController,
    ProductsPublicCatalogController,
    ProductsFeedController,
  ],
  providers: [ProductsService, ApiTokenGuard, ProductWebhooksService],
  exports: [ProductsService],
})
export class ProductsModule {}
