import { IsString } from 'class-validator';
import type { ProjectStatus } from '../project.entity';

export class ChangeStatusDto {
  @IsString()
  status: ProjectStatus; // валидируется по тенантским ProjectStatusDefinition в ProjectsService
}
