import { IsInt, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class PatchEmailFolderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
