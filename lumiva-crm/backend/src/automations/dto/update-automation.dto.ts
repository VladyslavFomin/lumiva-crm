// src/automations/dto/update-automation.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateAutomationDto } from './create-automation.dto';

export class UpdateAutomationDto extends PartialType(CreateAutomationDto) {}













