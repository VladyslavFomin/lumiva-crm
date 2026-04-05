// backend/src/tenants/dto/update-tenant-settings.dto.ts
import {
  IsOptional,
  IsString,
  MaxLength,
  IsIn,
  IsBoolean,
  IsEmail,
  IsDateString,
  Matches,
  ValidateIf,
  IsUUID,
} from 'class-validator';

export class UpdateTenantSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @Matches(
    /^(\/v1\/uploads\/\S+|https?:\/\/\S+)$/,
    { message: 'logoUrl: /v1/uploads/... или полный http(s) URL' },
  )
  @MaxLength(512)
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  uiLanguage?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(['basic', 'pro'], { message: 'plan должен быть basic или pro' })
  plan?: string;

  @IsOptional()
  @IsDateString({}, { message: 'activeUntil должен быть датой в ISO формате' })
  activeUntil?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  ownerName?: string | null;

  @IsOptional()
  @IsEmail({}, { message: 'ownerEmail должен быть валидным email' })
  @MaxLength(255)
  ownerEmail?: string | null;

  @IsOptional()
  @IsBoolean()
  apiEnabled?: boolean;

  @IsOptional()
  @IsString()
  notes?: string | null;

  /** UUID шаблона обёртки для AI/транзакционных писем; пусто = встроенный дизайн */
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsUUID()
  aiWrapperEmailTemplateId?: string | null;
}