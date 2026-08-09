import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { EMBED_FORM_KINDS, EMBED_TEMPLATE_KEYS } from '../embed-form-templates';

export class CreateEmbedFormDto {
  @IsUUID('4')
  @IsString()
  siteId!: string;

  /** Обязателен только для kind='lead' (или когда kind не задан вовсе — старое поведение);
   * для остальных трёх kind сервер сам подставляет служебный templateKey (см.
   * getKindDefaultTemplateKey), выбор раскладки шаблона у пользователя не запрашивается. */
  @ValidateIf((o) => !o.kind || o.kind === 'lead')
  @IsString()
  @IsNotEmpty()
  @IsIn([...EMBED_TEMPLATE_KEYS] as string[])
  templateKey?: string;

  @IsOptional()
  @IsString()
  @IsIn([...EMBED_FORM_KINDS] as string[])
  kind?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;
}
