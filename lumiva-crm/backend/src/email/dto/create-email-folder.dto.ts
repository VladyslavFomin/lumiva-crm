import { IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateEmailFolderDto {
  @IsUUID()
  accountId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  /** Только непустая строка UUID; иначе не гоняем через IsUUID (избегаем «UUID is not a string»). */
  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.trim() !== '')
  @IsUUID()
  parentId?: string | null;
}
