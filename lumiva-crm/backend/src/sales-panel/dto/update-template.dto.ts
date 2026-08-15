import { IsString, MinLength } from 'class-validator';

export class UpdateTemplateDto {
  @IsString()
  @MinLength(1)
  subject: string;

  @IsString()
  @MinLength(1)
  bodyHtml: string;
}
