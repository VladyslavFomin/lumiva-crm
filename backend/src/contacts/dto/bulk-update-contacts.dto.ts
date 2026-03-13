// src/contacts/dto/bulk-update-contacts.dto.ts
import { IsArray, IsUUID, IsString, IsOptional } from 'class-validator';

export class BulkUpdateContactsDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  contactIds: string[];

  @IsOptional()
  @IsUUID()
  assignedUserId?: string | null;

  @IsOptional()
  @IsString()
  assignedTo?: string | null;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagsToAdd?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagsToRemove?: string[];
}











