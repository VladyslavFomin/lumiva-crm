// src/email/dto/create-email-template.dto.ts
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  MaxLength,
} from 'class-validator';

export class CreateEmailTemplateDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  htmlBody?: string;

  @IsOptional()
  @IsString()
  textBody?: string;

  @IsOptional()
  @IsObject()
  meta?: {
    variables?: string[];
    category?: string;
    tags?: string[];
    previewImage?: string;
    [key: string]: any;
  };

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}













