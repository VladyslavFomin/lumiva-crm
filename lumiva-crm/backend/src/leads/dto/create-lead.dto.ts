// src/leads/dto/create-lead.dto.ts
import {
  IsOptional,
  IsString,
  IsUUID,
  IsObject,
  IsArray,
} from 'class-validator';

export class CreateLeadDto {
  @IsOptional()
  @IsUUID()
  siteId?: string | null;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  status?: string; // new, in_progress, waiting, won, lost

  @IsOptional()
  @IsString()
  source?: string | null;

  @IsOptional()
  @IsString()
  utmSource?: string | null;

  @IsOptional()
  @IsString()
  utmMedium?: string | null;

  @IsOptional()
  @IsString()
  utmCampaign?: string | null;

  @IsOptional()
  @IsString()
  utmContent?: string | null;

  @IsOptional()
  @IsString()
  utmTerm?: string | null;

  // ---- ответственный ----
  @IsOptional()
  @IsUUID()
  assignedUserId?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assignedUserIds?: string[] | null;

  @IsOptional()
  @IsString()
  assignedTo?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedToList?: string[] | null;

  // ---- связи ----
  @IsOptional()
  @IsUUID()
  contactId?: string | null;

  @IsOptional()
  @IsUUID()
  companyId?: string | null;

  // meta
  @IsOptional()
  @IsObject()
  meta?: any;

  // custom fields
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;

  // для истории (если прилетает comment при создании)
  @IsOptional()
  @IsString()
  comment?: string;
}
