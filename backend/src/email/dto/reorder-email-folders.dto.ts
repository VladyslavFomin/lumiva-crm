import { IsArray, IsInt, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderEmailFolderItemDto {
  @IsUUID()
  id: string;

  @IsInt()
  sortOrder: number;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}

export class ReorderEmailFoldersDto {
  @IsUUID()
  accountId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderEmailFolderItemDto)
  items: ReorderEmailFolderItemDto[];
}
