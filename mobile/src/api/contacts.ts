import { api } from './client';
import { EntityComment } from './comments';

export interface ContactDto {
  id: string;
  tenantId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  companyId: string | null;
  position: string | null;
  notes: string | null;
  tags: string[] | null;
  country: string | null;
  city: string | null;
  address: string | null;
  assignedTo: string | null;
  status: string | null;
  customFields: Record<string, any> | null;
  comments: EntityComment[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  companyId: string | null;
  position: string | null;
  notes: string | null;
  tags: string[];
  country: string | null;
  city: string | null;
  address: string | null;
  assignedTo: string | null;
  status: string | null;
  customFields: Record<string, any> | null;
  comments: EntityComment[];
  createdAt: string;
  updatedAt: string;
}

function mapContact(dto: ContactDto): Contact {
  return {
    id: dto.id,
    firstName: dto.firstName || '',
    lastName: dto.lastName || '',
    fullName: `${dto.firstName || ''} ${dto.lastName || ''}`.trim() || 'Без имени',
    email: dto.email,
    phone: dto.phone,
    companyId: dto.companyId,
    position: dto.position,
    notes: dto.notes,
    tags: dto.tags || [],
    country: dto.country,
    city: dto.city,
    address: dto.address,
    assignedTo: dto.assignedTo,
    status: dto.status,
    customFields: dto.customFields || null,
    comments: dto.comments || [],
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export async function fetchContacts(): Promise<Contact[]> {
  const res = await api.get<ContactDto[] | { items?: ContactDto[] }>('/contacts');
  const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
  return data.map(mapContact);
}

export async function fetchContact(id: string): Promise<Contact> {
  const res = await api.get<ContactDto>(`/contacts/${id}`);
  return mapContact(res.data);
}

export interface ContactRelatedRef {
  id: string;
  name: string | null;
  status?: string | null;
}

export interface ContactRelations {
  companyName: string | null;
  leads: ContactRelatedRef[];
  projects: ContactRelatedRef[];
}

export async function fetchContactRelations(id: string): Promise<ContactRelations> {
  const res = await api.get<{ company: { name: string } | null; leads: any[]; projects: any[] }>(`/contacts/${id}`, { params: { withRelations: 'true' } });
  return {
    companyName: res.data.company?.name || null,
    leads: (res.data.leads || []).map((l: any) => ({ id: l.id, name: l.name, status: l.status })),
    projects: (res.data.projects || []).map((p: any) => ({ id: p.id, name: p.name, status: p.status })),
  };
}

export interface CreateContactDto {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  companyId?: string | null;
  position?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  city?: string | null;
  assignedTo?: string | null;
}

export async function createContact(payload: CreateContactDto) {
  const res = await api.post<ContactDto>('/contacts', payload);
  return mapContact(res.data);
}

export interface UpdateContactDto {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  companyId?: string | null;
  position?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  customFields?: Record<string, any>;
  comments?: EntityComment[];
}

export async function updateContact(payload: UpdateContactDto) {
  const { id, ...body } = payload;
  const res = await api.patch<ContactDto>(`/contacts/${id}`, body);
  return mapContact(res.data);
}

export async function deleteContact(id: string) {
  await api.delete(`/contacts/${id}`);
}








