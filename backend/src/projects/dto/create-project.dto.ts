import {
  IsString,
  IsOptional,
  IsNumberString,
  IsIn,
  IsUUID,
  IsArray,
  IsObject,
  IsBoolean,
} from 'class-validator';
import type { ProjectStatus } from '../project.entity';

export class CreateProjectDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumberString()
  amount: string; // "11000.00"

  @IsOptional()
  @IsString()
  currency?: string; // EUR / TRY etc.

  @IsIn([
    'Новый',
    'В работе',
    'На проверке',
    'Заморожен',
    'Закрыт',
    'Выиграно',
    'Проиграно',
  ])
  status: ProjectStatus;

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
  tasks?: any[];

  @IsOptional()
  @IsArray()
  comments?: any[];

  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}