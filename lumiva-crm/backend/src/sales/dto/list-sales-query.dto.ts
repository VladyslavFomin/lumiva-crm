// src/sales/dto/list-sales-query.dto.ts
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SaleStatus } from '../sale-status.enum';

export class ListSalesQueryDto {
  @IsOptional()
  @IsString()
  from?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  to?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  channelId?: string;

  @IsOptional()
  @IsEnum(SaleStatus, { message: 'status must be valid sale status' })
  status?: SaleStatus;

  @IsOptional()
  @IsString()
  search?: string;

  /** Фильтр: продажи, привязанные к этому лиду */
  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsEnum(['native', 'converted'])
  currencyMode?: 'native' | 'converted';

  @IsOptional()
  @IsString()
  displayCurrency?: string;

  @IsOptional()
  @IsString()
  rates?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 25;
}
