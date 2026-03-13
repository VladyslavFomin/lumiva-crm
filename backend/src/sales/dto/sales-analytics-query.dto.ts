// src/sales/dto/sales-analytics-query.dto.ts
import { IsEnum, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SaleStatus } from '../sale-status.enum';

export type SalesDateField = 'saleDate' | 'createdAt';
export type CurrencyMode = 'native' | 'converted';

export class SalesAnalyticsQueryDto {
  @IsOptional()
  @IsString()
  from?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  to?: string; // YYYY-MM-DD

  @IsOptional()
  @IsEnum(['saleDate', 'createdAt'])
  dateField?: SalesDateField;

  @IsOptional()
  @IsString()
  channelIds?: string; // comma-separated

  @IsOptional()
  @IsEnum(SaleStatus, { message: 'status must be valid sale status' })
  status?: SaleStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(['native', 'converted'])
  currencyMode?: CurrencyMode;

  @IsOptional()
  @IsString()
  displayCurrency?: string;

  @IsOptional()
  @IsString()
  rates?: string; // JSON map of currency -> rate

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sampleLimit?: number = 200;
}
