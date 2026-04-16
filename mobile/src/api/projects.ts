import { api } from './client';

export type ProjectStatus =
  | 'Новый'
  | 'В работе'
  | 'На проверке'
  | 'Заморожен'
  | 'Закрыт';

export interface ProjectDto {
  id: string;
  tenantId: string;
  leadId: string | null;
  name: string;
  description: string | null;
  amount: string;
  currency: string;
  status: ProjectStatus;
  category: string | null;
  tags: string[] | null;
  ownerName: string | null;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  status: ProjectStatus;
  category: string | null;
  tags: string[];
  owner: string | null;
  createdAt: string;
  updatedAt?: string;
}

function mapProject(dto: ProjectDto): Project {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? '',
    amount: Number(dto.amount || 0),
    currency: dto.currency || 'EUR',
    status: dto.status,
    category: dto.category,
    tags: dto.tags ?? [],
    owner: dto.ownerName,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export async function fetchProjects(params?: { status?: ProjectStatus }) {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  const res = await api.get<{ total: number; items: ProjectDto[] }>(
    `/projects${search.toString() ? `?${search}` : ''}`,
  );
  return { total: res.data.total, items: res.data.items.map(mapProject) };
}

export async function fetchProject(id: string): Promise<Project> {
  const res = await api.get<ProjectDto>(`/projects/${id}`);
  return mapProject(res.data);
}
