import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { ProductCategory } from './product-category.entity';
import { ProductFieldDef } from './product-field-def.entity';
import { ProductAttribute } from './product-attribute.entity';
import { ProductVariant } from './product-variant.entity';
import { ProductStockMovement } from './product-stock-movement.entity';
import { ProductImportSession } from './product-import-session.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductsPublicController } from './products-public.controller';
import { ApiTokensModule } from '../api-tokens/api-tokens.module';
import { ApiTokenGuard } from '../api-tokens/api-token.guard';

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
    ]),
    ApiTokensModule,
  ],
  controllers: [ProductsController, ProductsPublicController],
  providers: [ProductsService, ApiTokenGuard],
  exports: [ProductsService],
})
export class ProductsModule {}
