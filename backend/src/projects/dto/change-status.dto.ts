import { IsIn } from 'class-validator';
import type { ProjectStatus } from '../project.entity';

export class ChangeStatusDto {
  @IsIn(['Новый', 'В работе', 'На проверке', 'Заморожен', 'Закрыт'])
  status: ProjectStatus;
}