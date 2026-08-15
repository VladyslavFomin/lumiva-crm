import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class OutlookCalendarOAuthStartDto {
  /** Относительный путь фронта после OAuth, например /integrations-hub?tab=connections */
  @IsOptional()
  @IsString()
  @MaxLength(400)
  redirectPath?: string;

  @IsIn(['create', 'reconnect'])
  intent!: 'create' | 'reconnect';

  @IsOptional()
  @IsUUID()
  integrationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  /** Graph id календаря Outlook; по умолчанию — календарь по умолчанию (/me/events) */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  calendarId?: string;
}
