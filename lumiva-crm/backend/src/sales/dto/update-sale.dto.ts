// src/sales/dto/update-sale.dto.ts
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  IsUUID,
  IsObject,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SaleStatus } from '../sale-status.enum';
import { EntityCommentDto } from '../../common/comment.types';

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

  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntityCommentDto)
  comments?: EntityCommentDto[];
}