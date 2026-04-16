import { IsIn, IsOptional, Matches } from 'class-validator';

/** Тело POST /automations/:id/run-now — период для шагов send_report (и др.) */
export class RunAutomationNowDto {
  @IsOptional()
  @IsIn(['last_7_days', 'last_30_days', 'this_month', 'yesterday', 'custom'])
  rangePreset?: 'last_7_days' | 'last_30_days' | 'this_month' | 'yesterday' | 'custom';

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateFrom?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateTo?: string;
}
