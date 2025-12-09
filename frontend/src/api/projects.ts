// src/api/projects.ts
import { api } from './client';
import type {
  Project,
  ProjectStatus,
  ProjectTask,
  ProjectComment,
} from '../pages/projects/projectTypes';

// ---- Типы, которые приходят с бэка ----
interface ApiProject {
  id: string;
  tenantId: string;
  leadId: string | null;
  name: string;
  description: string | null;
  amount: string;               // numeric → string
  currency: string;
  status: ProjectStatus;
  category: string | null;
  tags: string[] | null;
  ownerName: string | null;
  ownerUserId: string | null;
  briefFileName: string | null;
  briefFileUrl: string | null;
  tasks?: ProjectTask[] | null;
  comments?: ProjectComment[] | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Маппинг API → фронт ----
function mapProject(p: ApiProject): Project {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? '',
    amount: Number(p.amount || 0),
    currency: p.currency || 'EUR',
    status: p.status,
    category: p.category,
    tags: p.tags ?? [],

    // ответственный
    ownerUserId: p.ownerUserId ?? null,
    owner: p.ownerName,

    // лид
    leadId: p.leadId,
    // пока лида как объекта нет, берём name/email как null –
    // их мы заполняем только на фронте при выборе лида
    leadName: null,
    leadEmail: null,

    // файлы / доп.поля
    briefFileName: p.briefFileName ?? null,
    briefFileUrl: p.briefFileUrl ?? null,

    tasks: p.tasks ?? [],
    comments: p.comments ?? [],
    createdAt: new Date(p.createdAt).toLocaleString('ru-RU'),
    updatedAt: p.updatedAt
      ? new Date(p.updatedAt).toLocaleString('ru-RU')
      : undefined,
  };
}

// ---- DTO для создания/обновления ----
function projectToDto(p: Project) {
  return {
    name: p.name,
    description: p.description || null,
    amount: String(p.amount ?? 0),
    currency: p.currency || 'EUR',
    status: p.status,
    category: p.category ?? null,
    tags: p.tags && p.tags.length ? p.tags.join(',') : undefined,

    // ответственный
    ownerUserId: p.ownerUserId ?? undefined,
    ownerName: p.owner ?? undefined,

    // лид
    leadId: p.leadId ?? undefined,

    // файлы / доп.поля
    briefFileName: p.briefFileName ?? undefined,
    briefFileUrl: p.briefFileUrl ?? undefined,

    // если задач нет — не шлём поле вообще
    tasks: p.tasks && p.tasks.length ? p.tasks : undefined,
    comments: p.comments && p.comments.length ? p.comments : undefined,
  };
}

// ---- Публичные функции ----

// список проектов арендатора
export async function fetchProjects(params?: {
  status?: ProjectStatus;
  leadId?: string;
  q?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.leadId) qs.set('leadId', params.leadId);
  if (params?.q) qs.set('q', params.q);

  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await api.get<{ total: number; items: ApiProject[] }>(
    `/projects${query}`,
  );
  return {
    total: res.total,
    items: res.items.map(mapProject),
  };
}

// один проект по id
export async function fetchProject(id: string): Promise<Project> {
  const res = await api.get<ApiProject>(`/projects/${id}`);
  return mapProject(res);
}

// создать проект
export async function createProject(p: Project): Promise<Project> {
  const dto = projectToDto(p);
  const res = await api.post<ApiProject>('/projects', dto);
  return mapProject(res);
}

// обновить проект
export async function updateProject(p: Project): Promise<Project> {
  const dto = projectToDto(p);
  const res = await api.patch<ApiProject>(`/projects/${p.id}`, dto);
  return mapProject(res);
}

// смена статуса (для канбана)
export async function changeProjectStatus(
  id: string,
  status: ProjectStatus,
): Promise<Project> {
  const res = await api.patch<ApiProject>(`/projects/${id}/status`, { status });
  return mapProject(res);
}

// soft delete
export async function deleteProject(id: string): Promise<void> {
  await api.del(`/projects/${id}`);
}