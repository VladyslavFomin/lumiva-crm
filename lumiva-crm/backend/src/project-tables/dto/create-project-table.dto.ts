import { IsString } from 'class-validator';

export class CreateProjectTableDto {
  @IsString()
  name: string;
}
