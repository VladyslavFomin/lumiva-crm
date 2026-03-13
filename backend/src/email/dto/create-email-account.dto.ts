// src/email/dto/create-email-account.dto.ts
import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsInt,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateEmailAccountDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  // IMAP
  @IsOptional()
  @IsString()
  @MaxLength(255)
  imapHost?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  imapPort?: number;

  @IsOptional()
  @IsBoolean()
  imapSecure?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  imapUsername?: string;

  @IsOptional()
  @IsString()
  imapPassword?: string;

  // SMTP
  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpHost?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number;

  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpUsername?: string;

  @IsOptional()
  @IsString()
  smtpPassword?: string;

  // OAuth
  @IsOptional()
  @IsString()
  oauthProvider?: string; // 'gmail', 'outlook'

  @IsOptional()
  @IsString()
  oauthAccessToken?: string;

  @IsOptional()
  @IsString()
  oauthRefreshToken?: string;

  @IsOptional()
  @IsBoolean()
  syncIncoming?: boolean;

  @IsOptional()
  @IsBoolean()
  syncOutgoing?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  syncFolder?: string;
}













