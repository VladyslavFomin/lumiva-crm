import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { SmsProvider } from '../sms-config.entity';

export class SaveSmsConfigDto {
  @IsEnum(['twilio', 'smsc', 'smsru'])
  provider: SmsProvider;

  @IsObject()
  credentials: Record<string, string>;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  senderName?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
