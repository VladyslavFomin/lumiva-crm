// src/automations/dto/create-automation.dto.ts
import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  IsObject,
  MaxLength,
  Min,
} from 'class-validator';
import { TriggerEvent, ActionType } from '../automation.entity';

export class ConditionDto {
  @IsString()
  field: string;

  @IsString()
  operator: string; // 'equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'

  @IsOptional()
  value?: any;
}

export class ActionDto {
  @IsEnum(ActionType)
  type: ActionType;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

export class CreateAutomationDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(TriggerEvent)
  triggerEvent: TriggerEvent;

  @IsOptional()
  @IsArray()
  conditions?: ConditionDto[];

  @IsArray()
  actions: ActionDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxExecutions?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cooldownSeconds?: number;

  /** Для trigger scheduled: { schedule: {...}, contextLeadId?: string } — привязка к одному лиду для рассылки по расписанию */
  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;
}

