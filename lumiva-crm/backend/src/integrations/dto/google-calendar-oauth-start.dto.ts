import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class GoogleCalendarOAuthStartDto {
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

  /** ID календаря Google (email или primary); по умолчанию primary */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  calendarId?: string;
}
