// src/api/projects.ts
import { api } from './client';
import type {
  Project,
  ProjectStatus,
  ProjectTask,
  ProjectComment,
} from '../pages/projects/projectTypes';

export type { Project, ProjectStatus, ProjectTask, ProjectComment } from '../pages/projects/projectTypes';

const generateId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}${crypto.randomUUID()}`;
  }
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
};

const normalizeTasks = (tasks?: ProjectTask[] | null) =>
  (tasks ?? []).map((task) => ({
    ...task,
    id: task.id || generateId('t'),
    assignees: task.assignees ?? [],
    checklist: (task.checklist ?? []).map((item) => ({
      ...item,
      id: item.id || generateId('c'),
      done: Boolean(item.done),
    })),
  }));

// ---- Типы, которые приходят с бэка ----
interface ApiProject {
  id: string;
  tenantId: string;
  leadId: string | null;
  companyId?: string | null;
  name: string;
  description: string | null;
  amount: string;               // numeric → string
  currency: string;
  status: ProjectStatus;
  category: string | null;
  tags: string[] | null;
  ownerName: string | null;
  ownerUserId: string | null;
  ownerUserIds?: string[] | null;
  briefFileName: string | null;
  briefFileUrl: string | null;
  tasks?: ProjectTask[] | null;
  comments?: ProjectComment[] | null;
  customFields?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
  archivedAt?: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
}

/** UUID-списки с PG/TypeORM иногда приходят строкой `{id1,id2}` или с snake_case в JSON. */
function coerceUuidList(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((x) => (typeof x === 'string' || typeof x === 'number' ? String(x).trim() : ''))
      .filter((x) => x.length > 0);
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];
    if (s.startsWith('{') && s.endsWith('}')) {
      const inner = s.slice(1, -1).trim();
      if (!inner) return [];
      return inner
        .split(/,\s*/)
        .map((part) => part.replace(/^"(.*)"$/, '$1').trim())
        .filter(Boolean);
    }
    return s.split(',').map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

// ---- Маппинг API → фронт ----
function mapProject(p: ApiProject): Project {
  const normalizedStatus =
    p.status === 'Закрыт' ? ('Выиграно' as ProjectStatus) : p.status;
  const tasks = normalizeTasks(p.tasks);
  const raw = p as ApiProject & Record<string, unknown>;
  const ids = coerceUuidList(
    raw.ownerUserIds ?? raw.owner_user_ids ?? raw.ownerUserIDs,
  );
  const single =
    (typeof raw.ownerUserId === 'string' && raw.ownerUserId.trim()) ||
    (typeof raw.owner_user_id === 'string' && raw.owner_user_id.trim()) ||
    '';
  const ownerUserIds = ids.length > 0 ? ids : single ? [single] : [];
  const ownerName =
    (typeof p.ownerName === 'string' && p.ownerName) ||
    (typeof raw.owner_name === 'string' && raw.owner_name) ||
    null;
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? '',
    amount: Number(p.amount || 0),
    currency: p.currency || 'EUR',
    status: normalizedStatus,
    category: p.category,
    tags: p.tags ?? [],

    // ответственный
    ownerUserId: (ownerUserIds[0] ?? p.ownerUserId ?? single) || null,
    ownerUserIds,
    owner: ownerName,

    // лид / компания
    leadId: p.leadId,
    companyId: p.companyId != null ? p.companyId : null,
    // name/email — заполняем на фронте при выборе лида
    leadName: null,
    leadEmail: null,
    companyName: null,

    // файлы / доп.поля
    briefFileName: p.briefFileName ?? null,
    briefFileUrl: p.briefFileUrl ?? null,
    customFields: p.customFields ?? null,

    tasks,
    comments: p.comments ?? [],
    createdAt: new Date(p.createdAt).toLocaleString('ru-RU'),
    updatedAt: p.updatedAt
      ? new Date(p.updatedAt).toLocaleString('ru-RU')
      : undefined,
    isArchived: p.isArchived ?? false,
    isDeleted: p.isDeleted ?? false,
    archivedAt: p.archivedAt ?? null,
    deletedAt: p.deletedAt ?? null,
  };
}

// ---- DTO для создания/обновления ----
function projectToDto(
  p: Project,
  options?: {
    includeEmptyTasks?: boolean;
    includeEmptyComments?: boolean;
  },
) {
  const includeEmptyTasks = Boolean(options?.includeEmptyTasks);
  const includeEmptyComments = Boolean(options?.includeEmptyComments);
  return {
    name: p.name,
    description: p.description || null,
    amount: String(p.amount ?? 0),
    currency: p.currency || 'EUR',
    status: p.status,
    category: p.category ?? null,
    tags: p.tags && p.tags.length ? p.tags.join(',') : undefined,

    // ответственный
    ownerUserId:
      p.ownerUserIds && p.ownerUserIds.length
        ? p.ownerUserIds[0]
        : p.ownerUserId ?? undefined,
    ownerUserIds:
      p.ownerUserIds && p.ownerUserIds.length ? p.ownerUserIds : undefined,
    ownerName: p.owner ?? undefined,

    // лид / компания (null явно, чтобы сбрасывать ссылку)
    leadId: p.leadId === null ? null : p.leadId || undefined,
    companyId:
      p.companyId === null
        ? null
        : p.companyId === undefined
          ? undefined
          : p.companyId,

    // файлы / доп.поля
    briefFileName: p.briefFileName ?? undefined,
    briefFileUrl: p.briefFileUrl ?? undefined,
    customFields: p.customFields ?? undefined,

    // если задач нет — не шлём поле вообще (если не просят очистить)
    tasks: includeEmptyTasks
      ? p.tasks ?? []
      : p.tasks && p.tasks.length
        ? p.tasks
        : undefined,
    comments: includeEmptyComments
      ? p.comments ?? []
      : p.comments && p.comments.length
        ? p.comments
        : undefined,
  };
}

// ---- Публичные функции ----

// список проектов арендатора
export async function fetchProjects(params?: {
  status?: ProjectStatus;
  leadId?: string;
  q?: string;
  archived?: boolean;
  deleted?: boolean;
}) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.leadId) qs.set('leadId', params.leadId);
  if (params?.q) qs.set('q', params.q);
  if (params?.archived) qs.set('archived', 'true');
  if (params?.deleted) qs.set('deleted', 'true');

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
export async function updateProject(
  p: Project,
  options?: {
    includeEmptyTasks?: boolean;
    includeEmptyComments?: boolean;
  },
): Promise<Project> {
  const dto = projectToDto(p, options);
  const res = await api.patch<ApiProject>(`/projects/${p.id}`, dto);
  return mapProject(res);
}

export async function archiveProject(id: string): Promise<Project> {
  const res = await api.patch<ApiProject>(`/projects/${id}/archive`, {});
  return mapProject(res);
}

export async function unarchiveProject(id: string): Promise<Project> {
  const res = await api.patch<ApiProject>(`/projects/${id}/unarchive`, {});
  return mapProject(res);
}

export async function restoreProject(id: string): Promise<Project> {
  const res = await api.patch<ApiProject>(`/projects/${id}/restore`, {});
  return mapProject(res);
}

export async function permanentlyDeleteProject(id: string): Promise<void> {
  await api.del(`/projects/${id}/permanent`);
}

export async function emptyProjectsTrash(): Promise<void> {
  await api.del('/projects/trash/empty');
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  action: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
  payload?: Record<string, any> | null;
  createdAt: string;
}

export async function fetchProjectActivities(
  id: string,
): Promise<ProjectActivity[]> {
  return api.get<ProjectActivity[]>(`/projects/${id}/activities`);
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