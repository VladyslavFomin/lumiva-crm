// backend/src/tenants/dto/update-tenant-settings.dto.ts
import {
  IsOptional,
  IsString,
  MaxLength,
  IsUrl,
  IsIn,
  IsBoolean,
  IsEmail,
  IsDateString,
} from 'class-validator';

export class UpdateTenantSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsUrl({}, { message: 'logoUrl должен быть валидным URL' })
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
}