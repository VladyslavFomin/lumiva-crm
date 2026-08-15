import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { SalesInvitationLanguage } from '../sales-invitation.entity';
import { AttachmentRefDto } from './attachment-ref.dto';

export class TestInvitationDto {
  @IsEmail()
  to: string;

  @IsIn(['en', 'ru', 'tr'])
  language: SalesInvitationLanguage;

  @IsOptional()
  @IsString()
  @MinLength(1)
  subject?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  bodyHtml?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentRefDto)
  attachments?: AttachmentRefDto[];
}
