import { IsEmail, IsNumber, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateCcpClientMetaDto {
  // NEW (реальные ключи в твоём WP)
  @IsOptional()
  @IsNumber()
  ccp_acc_eur_balance?: number;

  @IsOptional()
  @IsNumber()
  ccp_acc_usd_balance?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ccp_acc_eur_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ccp_acc_usd_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  ccp_analytics_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  ccp_files_list?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ccp_tg_chat_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ccp_investment_style?: string;

  @IsOptional()
  @IsNumber()
  ccp_investment_annual_percent?: number;

  @IsOptional()
  @IsNumber()
  ccp_credit_leverage?: number;

  @IsOptional()
  @IsNumber()
  ccp_credit_repay_monthly_percent?: number;

  @IsOptional()
  @IsNumber()
  ccp_investment_profit_monthly_percent?: number;

  @IsOptional()
  @IsNumber()
  ccp_account_debit_monthly_percent?: number;

  // LEGACY (оставляем для совместимости)
  @IsOptional()
  @IsNumber()
  ccp_balance_eur?: number;

  @IsOptional()
  @IsNumber()
  ccp_balance_usd?: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  ccp_iban_eur?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  ccp_iban_usd?: string;
}

export class UpdateCcpClientDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateCcpClientMetaDto)
  meta?: UpdateCcpClientMetaDto;
}