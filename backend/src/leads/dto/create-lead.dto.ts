// src/leads/dto/create-lead.dto.ts
import {
  IsOptional,
  IsString,
  IsUUID,
  IsObject,
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

  // ---- ответственный ----
  @IsOptional()
  @IsUUID()
  assignedUserId?: string | null;

  @IsOptional()
  @IsString()
  assignedTo?: string | null;

  // meta
  @IsOptional()
  @IsObject()
  meta?: any;

  // для истории (если прилетает comment при создании)
  @IsOptional()
  @IsString()
  comment?: string;
}