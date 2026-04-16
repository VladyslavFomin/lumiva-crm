// src/api/notes.ts
import { api } from './client';

export type EntityType = 'lead' | 'contact' | 'company' | 'project' | 'sale' | 'user';

export type NoteType = 'note' | 'call' | 'meeting' | 'email' | 'task' | 'reminder';

export interface Note {
  id: string;
  tenantId: string;
  entityType: EntityType;
  entityId: string;
  content: string;
  title: string | null;
  type: NoteType;
  metadata: Record<string, any> | null;
  createdById: string | null;
  createdBy: string | null;
  isPrivate: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteDto {
  entityType: EntityType;
  entityId: string;
  content: string;
  title?: string;
  type?: NoteType;
  metadata?: Record<string, any>;
  isPrivate?: boolean;
  tags?: string[];
}

export interface UpdateNoteDto {
  content?: string;
  title?: string;
  type?: NoteType;
  metadata?: Record<string, any>;
  isPrivate?: boolean;
  tags?: string[];
}

export interface ListNotesQuery {
  entityType?: EntityType;
  entityId?: string;
  type?: NoteType;
  search?: string;
  createdById?: string;
  limit?: number;
  offset?: number;
}

export async function fetchNotes(query?: ListNotesQuery): Promise<{ items: Note[]; total: number }> {
  const res = await api.get<{ items: Note[]; total: number }>('/notes', { params: query });
  return res;
}

export async function fetchNote(id: string): Promise<Note> {
  const res = await api.get<Note>(`/notes/${id}`);
  return res;
}

export async function createNote(dto: CreateNoteDto): Promise<Note> {
  const res = await api.post<Note>('/notes', dto);
  return res;
}

export async function updateNote(id: string, dto: UpdateNoteDto): Promise<Note> {
  const res = await api.patch<Note>(`/notes/${id}`, dto);
  return res;
}

export async function deleteNote(id: string): Promise<void> {
  await api.delete(`/notes/${id}`);
}













