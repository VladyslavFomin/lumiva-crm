// src/custom-fields/dto/create-custom-field.dto.ts
import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  MaxLength,
  Min,
} from 'class-validator';
import { EntityType, FieldType } from '../custom-field.entity';

export class CreateCustomFieldDto {
  @IsEnum(EntityType)
  entityType: EntityType;

  @IsString()
  @MaxLength(100)
  key: string; // Должен быть уникальным для entityType

  @IsString()
  @MaxLength(255)
  label: string;

  @IsEnum(FieldType)
  type: FieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsString()
  placeholder?: string;

  @IsOptional()
  @IsString()
  helpText?: string;

  @IsOptional()
  @IsArray()
  options?: Array<{ value: string; label: string }>; // Для select/multiselect

  @IsOptional()
  @IsString()
  defaultValue?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}













