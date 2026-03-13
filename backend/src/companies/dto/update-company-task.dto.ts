// src/companies/dto/update-company-task.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateCompanyTaskDto } from './create-company-task.dto';

export class UpdateCompanyTaskDto extends PartialType(CreateCompanyTaskDto) {}











