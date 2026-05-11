import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Старт OAuth Google Ads (authorization code) — только с платформенным OAuth-клиентом.
 */
export class GoogleAdsOAuthStartDto {
  @IsIn(['create', 'reconnect'])
  intent!: 'create' | 'reconnect';

  @IsOptional()
  @IsUUID('4')
  integrationId?: string;

  /** Путь на фронте после OAuth (только относительный, без схемы). */
  @IsOptional()
  @IsString()
  @MaxLength(400)
  redirectPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  primaryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  loginCustomerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  medium?: string;

  /** Один рекламный аккаунт или синк всех активных клиентов под MCC (primaryId — Customer ID менеджерского счёта). */
  @IsOptional()
  @IsIn(['customer', 'mcc_managed'])
  googleAdsAccountMode?: 'customer' | 'mcc_managed';
}
