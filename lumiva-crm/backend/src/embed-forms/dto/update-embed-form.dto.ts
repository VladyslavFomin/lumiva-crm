import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateEmbedFormDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsObject()
  fieldConfig?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  design?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  privacyPolicyUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  successMessage?: string | null;
}
