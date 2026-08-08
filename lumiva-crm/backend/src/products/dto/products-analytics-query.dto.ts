// src/products/dto/products-analytics-query.dto.ts
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ProductStatus } from '../product.entity';

export class ProductsAnalyticsQueryDto {
  @IsOptional()
  @IsString()
  from?: string; // YYYY-MM-DD, фильтр по createdAt (для товаров и таймлайна остатков)

  @IsOptional()
  @IsString()
  to?: string; // YYYY-MM-DD

  @IsOptional()
  @IsEnum(['active', 'draft', 'archived', 'out_of_stock'])
  status?: ProductStatus;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  displayCurrency?: string;

  @IsOptional()
  @IsString()
  rates?: string; // JSON map валюта -> множитель к displayCurrency (см. GET /marketing/fx-rates)
}
