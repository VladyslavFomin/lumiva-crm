// src/api/contacts.ts
import { api } from './client';

export interface Contact {
  id: string;
  tenantId: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  company: string | null;
  companyId: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  timezone: string | null;
  language: string | null;
  linkedin: string | null;
  telegram: string | null;
  website: string | null;
  tags: string[];
  assignedUserId: string | null;
  assignedTo: string | null;
  status: string;
  customFields: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  position?: string;
  company?: string;
  companyId?: string;
  country?: string;
  city?: string;
  address?: string;
  timezone?: string;
  language?: string;
  linkedin?: string;
  telegram?: string;
  website?: string;
  tags?: string[];
  assignedUserId?: string;
  assignedTo?: string;
  status?: string;
  customFields?: Record<string, any>;
}

export interface UpdateContactDto extends Partial<CreateContactDto> {}

export interface ListContactsQuery {
  search?: string;
  status?: string;
  assignedUserId?: string;
  companyId?: string;
  tags?: string[];
  country?: string;
  limit?: number;
  offset?: number;
}

export async function fetchContacts(query?: ListContactsQuery): Promise<{ items: Contact[]; total: number }> {
  const res = await api.get<{ items: Contact[]; total: number }>('/contacts', { params: query });
  return res;
}

export async function fetchContact(id: string): Promise<Contact> {
  const res = await api.get<Contact>(`/contacts/${id}`);
  return res;
}

export async function createContact(dto: CreateContactDto): Promise<Contact> {
  const res = await api.post<Contact>('/contacts', dto);
  return res;
}

export async function updateContact(id: string, dto: UpdateContactDto): Promise<Contact> {
  const res = await api.patch<Contact>(`/contacts/${id}`, dto);
  return res;
}

export async function deleteContact(id: string): Promise<void> {
  await api.delete(`/contacts/${id}`);
}

// ========== BULK OPERATIONS ==========

export interface BulkUpdateContactsDto {
  contactIds: string[];
  assignedUserId?: string | null;
  assignedTo?: string | null;
  status?: string;
  tagsToAdd?: string[];
  tagsToRemove?: string[];
}

export interface BulkUpdateResult {
  success: boolean;
  updated: number;
}

export async function bulkUpdateContacts(
  dto: BulkUpdateContactsDto,
): Promise<BulkUpdateResult> {
  const res = await api.post<BulkUpdateResult>('/contacts/bulk-update', dto);
  return res;
}



