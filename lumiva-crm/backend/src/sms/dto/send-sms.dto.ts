import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { SmsEntityType } from '../sms-message.entity';

export class SendSmsDto {
  @IsString()
  to: string;

  @IsString()
  @MaxLength(1600)
  body: string;

  @IsOptional()
  @IsEnum(['contact', 'lead', 'company'])
  entityType?: SmsEntityType;

  @IsOptional()
  @IsUUID()
  entityId?: string;
}
