import {
  IsString,
  IsOptional,
  IsUUID,
  IsObject,
  MaxLength,
} from 'class-validator';

export class PreviewStyledMailDto {
  @IsString()
  @MaxLength(500)
  subject: string;

  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  headline?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsUUID()
  leadId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  saleId?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;
}
