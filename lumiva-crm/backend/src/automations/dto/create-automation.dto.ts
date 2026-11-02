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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
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

  // @Type обязателен: с enableImplicitConversion без него class-transformer превращал каждый элемент в [] —
  // условия сохранялись как [[]] и ломали автоматизацию
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions?: ConditionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
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

