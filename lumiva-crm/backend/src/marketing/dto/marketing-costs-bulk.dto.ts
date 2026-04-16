// backend/src/marketing/dto/marketing-costs-bulk.dto.ts
import { IsArray, ValidateNested, IsString, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class MarketingCostItemDto {
  @IsString()
  date: string; // YYYY-MM-DD

  @IsString()
  sourceSystem: string; // google_ads, meta_ads, yandex_direct, ...

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  utmSource?: string;

  @IsOptional()
  @IsString()
  utmMedium?: string;

  @IsOptional()
  @IsString()
  utmCampaign?: string;

  @IsOptional()
  @IsNumber()
  impressions?: number;

  @IsOptional()
  @IsNumber()
  clicks?: number;

  @IsNumber()
  cost: number;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class MarketingCostsBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketingCostItemDto)
  items: MarketingCostItemDto[];
}