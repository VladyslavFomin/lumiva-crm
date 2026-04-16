// src/companies/dto/bulk-update-companies.dto.ts
import { IsArray, IsUUID, IsString, IsOptional, IsEnum } from 'class-validator';

export class BulkUpdateCompaniesDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  companyIds: string[];

  @IsOptional()
  @IsUUID()
  assignedUserId?: string | null;

  @IsOptional()
  @IsString()
  assignedTo?: string | null;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagsToAdd?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagsToRemove?: string[];
}











