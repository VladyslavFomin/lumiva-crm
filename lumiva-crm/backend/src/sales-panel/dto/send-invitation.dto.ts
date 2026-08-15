import { IsArray, IsIn, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { SalesInvitationLanguage } from '../sales-invitation.entity';
import { AttachmentRefDto } from './attachment-ref.dto';

export class SendInvitationDto {
  @IsIn(['en', 'ru', 'tr'])
  language: SalesInvitationLanguage;

  /** Overrides the DB template — lets the admin freely edit subject/HTML before sending. */
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
