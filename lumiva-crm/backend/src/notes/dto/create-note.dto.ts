// src/notes/dto/create-note.dto.ts
import {
  IsString,
  IsUUID,
  IsOptional,
  IsArray,
  IsBoolean,
  MaxLength,
  IsEnum,
} from 'class-validator';

export enum EntityType {
  CONTACT = 'contact',
  COMPANY = 'company',
  LEAD = 'lead',
  SALE = 'sale',
  PROJECT = 'project',
}

export enum NoteType {
  NOTE = 'note',
  CALL = 'call',
  MEETING = 'meeting',
  EMAIL = 'email',
  TASK = 'task',
  REMINDER = 'reminder',
}

export class CreateNoteDto {
  @IsEnum(EntityType)
  entityType: EntityType;

  @IsUUID()
  entityId: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsEnum(NoteType)
  type?: NoteType;

  @IsOptional()
  metadata?: any;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}













