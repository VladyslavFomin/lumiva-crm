// src/leads/dto/update-lead.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateLeadDto } from './create-lead.dto';

export class UpdateLeadDto extends PartialType(CreateLeadDto) {}