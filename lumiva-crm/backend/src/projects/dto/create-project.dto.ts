import {
  IsString,
  IsOptional,
  IsNumberString,
  IsUUID,
  IsArray,
  IsObject,
  IsBoolean,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { ProjectStatus } from '../project.entity';

export class CreateProjectDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumberString()
  amount: string; // "11000.00"

  // crm_projects.currency — character(3): без этой проверки тенантская валюта длиннее
  // 3 символов (валидация в CreateProjectCurrencyDto раньше допускала до 8) валила
  // сохранение проекта сырой ошибкой Postgres "value too long for type character(3)".
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string; // EUR / TRY etc.

  @IsString()
  status: ProjectStatus; // валидируется по тенантским ProjectStatusDefinition в ProjectsService

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  tags?: string; // "CRM,IT,WEB" – для удобства с фронта

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  ownerUserIds?: string[];

  @IsOptional()
  @IsUUID()
  leadId?: string;

  @IsOptional()
  @IsUUID()
  tableId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedProjectIds?: string[];

  @IsOptional()
  @IsString()
  briefFileName?: string;

  @IsOptional()
  @IsString()
  briefFileUrl?: string;

  @IsOptional()
  @IsArray()
  @Type(() => Object)
  files?: any[];

  @IsOptional()
  @IsArray()
  @Type(() => Object)
  tasks?: any[];

  @IsOptional()
  @IsArray()
  @Type(() => Object)
  comments?: any[];

  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}