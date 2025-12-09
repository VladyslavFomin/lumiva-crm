// src/tenants/dto/create-tenant.dto.ts
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsISO8601,
} from 'class-validator';

export type TenantPlan = 'basic' | 'pro'; // если где-то уже есть тип/enum — подгони под него

export class CreateTenantDto {
  @IsString()
  name: string;

  @IsString()
  clientKey: string;

  @IsIn(['basic', 'pro'])
  plan: TenantPlan;

  // ----- новое -----

  // до какой даты активен (string в ISO, фронт шлёт ISO)
  @IsOptional()
  @IsISO8601()
  activeUntil?: string | null;

  // имя владельца
  @IsOptional()
  @IsString()
  ownerName?: string | null;

  // email владельца
  @IsOptional()
  @IsEmail()
  ownerEmail?: string | null;

  // сразу включить/выключить API
  @IsOptional()
  @IsBoolean()
  apiEnabled?: boolean;

  // на будущее — заметки по тенанту (если нужно при создании)
  @IsOptional()
  @IsString()
  notes?: string | null;
}