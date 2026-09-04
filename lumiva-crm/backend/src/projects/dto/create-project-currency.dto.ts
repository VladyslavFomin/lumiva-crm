import { IsString, IsOptional, IsBoolean, Matches, MaxLength } from 'class-validator';

export class CreateProjectCurrencyDto {
  // crm_projects.currency — character(3): длиннее 3 символов Postgres отклонит при
  // сохранении проекта с этим кодом ("value too long for type character(3)"), а не
  // при создании самого определения валюты, где ограничение раньше не совпадало.
  @IsString()
  @Matches(/^[A-Za-z0-9]{3}$/)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  label?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
