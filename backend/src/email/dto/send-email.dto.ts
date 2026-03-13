// src/email/dto/send-email.dto.ts
import {
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class SendEmailDto {
  @IsUUID()
  accountId: string; // Email аккаунт для отправки

  @IsEmail({}, { each: true })
  @IsArray()
  to: string[]; // Получатели

  @IsOptional()
  @IsEmail({}, { each: true })
  @IsArray()
  cc?: string[];

  @IsOptional()
  @IsEmail({}, { each: true })
  @IsArray()
  bcc?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subject?: string;

  @IsOptional()
  @IsString()
  textBody?: string; // Текстовое тело

  @IsOptional()
  @IsString()
  htmlBody?: string; // HTML тело

  @IsOptional()
  @IsUUID()
  templateId?: string; // ID шаблона письма (если указан, используется вместо subject/textBody/htmlBody)

  // Связи
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  leadId?: string;

  @IsOptional()
  @IsUUID()
  saleId?: string;

  @IsOptional()
  @IsArray()
  attachments?: Array<{
    filename: string;
    contentType: string;
    contentBase64?: string;
  }>;
}


