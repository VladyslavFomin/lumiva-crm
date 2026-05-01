import { IsArray, IsBoolean, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class PushRecordsToBoardDto {
  @IsUUID()
  targetObjectId!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  recordIds!: string[];

  /** Явный маппинг: ключ поля источника → ключ поля цели */
  @IsOptional()
  @IsObject()
  fieldMap?: Record<string, string>;

  /** Не подставлять авто-маппинг по совпадению ключей для этих полей цели */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  omitAutoTargetKeys?: string[];

  /** Поле в целевой таблице для проверки дубликатов (values.key) */
  @IsOptional()
  @IsString()
  duplicateKeyTargetField?: string | null;

  @IsOptional()
  @IsBoolean()
  skipDuplicates?: boolean;
}
