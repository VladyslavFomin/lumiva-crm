import { IsIn, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { EMBED_TEMPLATE_KEYS } from '../embed-form-templates';

export class CreateEmbedFormDto {
  @IsUUID('4')
  @IsString()
  siteId!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([...EMBED_TEMPLATE_KEYS] as string[])
  templateKey!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;
}
