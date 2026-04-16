import { IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateCcpTxnMetaDto {
  @IsOptional()
  @IsInt()
  ccp_user_id?: number;

  @IsOptional()
  @IsNumber()
  ccp_spend_eur?: number;

  @IsOptional()
  @IsNumber()
  ccp_spend_usd?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  ccp_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  ccp_desc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ccp_status?: string;
}

export class UpdateCcpTxnDto {
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
  @Type(() => UpdateCcpTxnMetaDto)
  meta?: UpdateCcpTxnMetaDto;
}