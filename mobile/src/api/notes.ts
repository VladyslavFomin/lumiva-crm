import { api } from './client';

export type NoteEntityType = 'lead' | 'contact' | 'company' | 'project' | 'sale' | 'user' | 'reservation';

export interface Note {
  id: string;
  entityType: NoteEntityType;
  entityId: string;
  content: string;
  title: string | null;
  type: string;
  createdBy: string | null;
  isPrivate: boolean;
  createdAt: string;
}

/** Standalone notes (`/notes`, RBAC `notes`) — the website's booking card has a Notes tab backed by this; separate from entity comments. */
export async function fetchNotes(entityType: NoteEntityType, entityId: string): Promise<Note[]> {
  const res = await api.get<{ items: Note[] }>('/notes', { params: { entityType, entityId } });
  return res.data.items;
}

export async function createNote(entityType: NoteEntityType, entityId: string, content: string): Promise<Note> {
  const res = await api.post<Note>('/notes', { entityType, entityId, content, type: 'note' });
  return res.data;
}

export async function deleteNote(id: string): Promise<void> {
  await api.delete(`/notes/${id}`);
}
