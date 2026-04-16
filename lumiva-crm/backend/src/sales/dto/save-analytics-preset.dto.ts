// src/sales/dto/save-analytics-preset.dto.ts
import { IsObject } from 'class-validator';

export class SaveAnalyticsPresetDto {
  @IsObject()
  payload!: Record<string, any>;
}
