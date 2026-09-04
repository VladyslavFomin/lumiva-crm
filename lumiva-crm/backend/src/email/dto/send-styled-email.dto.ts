import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  IsEmail,
  IsObject,
  MaxLength,
} from 'class-validator';

export class SendStyledEmailDto {
  @IsUUID()
  accountId: string;

  @IsEmail({}, { each: true })
  @IsArray()
  to: string[];

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

  @IsOptional()
  @IsArray()
  attachments?: Array<{
    filename: string;
    contentType: string;
    contentBase64?: string;
  }>;
}
