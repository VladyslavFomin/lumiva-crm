import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { CustomObjectFieldType } from '../custom-object-field.entity';

export class UpdateCustomObjectFieldDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsIn([
    'text',
    'number',
    'date',
    'datetime',
    'boolean',
    'status',
    'select',
    'multiselect',
    'file',
  ] satisfies CustomObjectFieldType[])
  type?: CustomObjectFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  options?: Array<{ value: string; label: string }>;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;
}

