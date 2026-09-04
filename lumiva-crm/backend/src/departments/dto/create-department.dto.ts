// src/departments/dto/create-department.dto.ts
import { IsString, IsOptional, IsUUID, IsBoolean, IsInt, Min, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  code?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsUUID()
  managerId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}










