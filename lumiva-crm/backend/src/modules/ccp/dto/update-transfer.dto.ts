import { IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateCcpTransferMetaDto {
  @IsOptional()
  @IsNumber()
  ccp_tr_amount?: number;

  // NEW (как у тебя в админке WP)
  @IsOptional()
  @IsIn(['EUR', 'USD'])
  ccp_tr_from_cur?: 'EUR' | 'USD';

  @IsOptional()
  @IsIn(['EUR', 'USD'])
  ccp_tr_to_cur?: 'EUR' | 'USD';

  @IsOptional()
  @IsNumber()
  ccp_tr_rate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  ccp_tr_desc?: string;

  // LEGACY (оставляем)
  @IsOptional()
  @IsIn(['EUR', 'USD'])
  ccp_tr_currency?: 'EUR' | 'USD';

  @IsOptional()
  @IsInt()
  ccp_tr_from_user?: number;

  @IsOptional()
  @IsInt()
  ccp_tr_to_user?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  ccp_tr_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  ccp_tr_note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ccp_tr_status?: string;
}

export class UpdateCcpTransferDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateCcpTransferMetaDto)
  meta?: UpdateCcpTransferMetaDto;
}