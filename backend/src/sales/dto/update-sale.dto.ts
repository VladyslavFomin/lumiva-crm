// src/sales/dto/update-sale.dto.ts
import { IsEnum, IsOptional, IsString, MaxLength, IsUUID } from 'class-validator';
import { SaleStatus } from '../sale-status.enum';

export class UpdateSaleDto {
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  managerName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  // Привязка к лиду (опционально)
  @IsOptional()
  @IsUUID('4')
  leadId?: string | null;
}