// src/common/comment.types.ts
import { IsArray, IsOptional, IsString } from 'class-validator';

/**
 * Общая форма комментария, уже использовавшаяся отдельно на Lead (LeadComment) и Project
 * (ProjectComment) — здесь один переиспользуемый тип для Sale/Contact/Company (см.
 * MOBILE_DATA_PARITY_PLAN.md §17), чтобы не плодить третью-четвёртую-пятую копию одной формы.
 * Упоминания — не структурная фича: `mentions` это просто @токены, извлечённые regex'ом из
 * текста на фронте, без резолва в конкретного сотрудника на бэкенде (см. план).
 */
export interface EntityComment {
  id: string;
  author: string;
  createdAt: string;
  text: string;
  mentions?: string[];
  parentId?: string | null;
  likedBy?: string[];
}

export class EntityCommentDto {
  @IsString()
  id: string;

  @IsString()
  author: string;

  @IsString()
  createdAt: string;

  @IsString()
  text: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  likedBy?: string[];
}
