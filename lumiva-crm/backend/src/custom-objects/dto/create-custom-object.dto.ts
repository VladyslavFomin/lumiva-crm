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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { CustomObjectFieldType } from '../custom-object-field.entity';

class CreateCustomObjectFieldInputDto {
  @IsString()
  @MaxLength(120)
  key: string;

  @IsString()
  @MaxLength(200)
  label: string;

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
  type: CustomObjectFieldType;

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
}

export class CreateCustomObjectDto {
  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCustomObjectFieldInputDto)
  fields?: CreateCustomObjectFieldInputDto[];
}

