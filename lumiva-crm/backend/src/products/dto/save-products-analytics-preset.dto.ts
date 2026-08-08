// src/products/dto/save-products-analytics-preset.dto.ts
import { IsObject } from 'class-validator';

export class SaveProductsAnalyticsPresetDto {
  @IsObject()
  payload!: Record<string, any>;
}
