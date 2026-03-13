// src/companies/dto/create-company-task.dto.ts
import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  IsArray,
  IsObject,
  IsInt,
  Min,
} from 'class-validator';

export type CompanyTaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';

export class CreateCompanyTaskDto {
  @IsUUID()
  companyId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(['todo', 'in_progress', 'review', 'done', 'cancelled'])
  status?: CompanyTaskStatus;

  @IsOptional()
  @IsString()
  priority?: string | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string | null;

  @IsOptional()
  @IsString()
  assignedTo?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  meta?: any;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}











