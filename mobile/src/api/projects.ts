import { api } from './client';
import { EntityComment } from './comments';

export type ProjectStatus =
  | 'Новый'
  | 'В работе'
  | 'На проверке'
  | 'Заморожен'
  | 'Закрыт';

export type TaskStatus = 'К выполнению' | 'В работе' | 'На проверке' | 'Заблокировано' | 'Отложено' | 'Готово';
export type TaskPriority = 'Обычный' | 'Высокий' | 'Низкий';

export interface ProjectTaskChecklistItem {
  id: string;
  title: string;
  done: boolean;
}

export interface ProjectTask {
  id: string;
  title: string;
  assignees: string[];
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string | null;
  checklist: ProjectTaskChecklistItem[];
}

export interface ProjectFileLink {
  id: string;
  label: string;
  url: string;
  provider: string;
  createdAt: string;
}

export interface ProjectDto {
  id: string;
  tenantId: string;
  leadId: string | null;
  companyId?: string | null;
  contactId?: string | null;
  ownerUserIds?: string[] | null;
  relatedProjectIds?: string[] | null;
  briefFileName?: string | null;
  briefFileUrl?: string | null;
  name: string;
  description: string | null;
  amount: string;
  currency: string;
  status: ProjectStatus;
  category: string | null;
  tags: string[] | null;
  ownerName: string | null;
  ownerUserId: string | null;
  files: ProjectFileLink[] | null;
  tasks: ProjectTask[] | null;
  customFields: Record<string, any> | null;
  comments: EntityComment[] | null;
  isArchived?: boolean;
  archivedAt?: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
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
  ownerUserIds: string[];
  leadId: string | null;
  companyId: string | null;
  contactId: string | null;
  relatedProjectIds: string[];
  briefFileName: string | null;
  briefFileUrl: string | null;
  files: ProjectFileLink[];
  tasks: ProjectTask[];
  customFields: Record<string, any> | null;
  comments: EntityComment[];
  isArchived: boolean;
  archivedAt: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
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
    ownerUserIds: dto.ownerUserIds ?? (dto.ownerUserId ? [dto.ownerUserId] : []),
    leadId: dto.leadId ?? null,
    companyId: dto.companyId ?? null,
    contactId: dto.contactId ?? null,
    relatedProjectIds: dto.relatedProjectIds ?? [],
    briefFileName: dto.briefFileName ?? null,
    briefFileUrl: dto.briefFileUrl ?? null,
    files: dto.files ?? [],
    tasks: dto.tasks ?? [],
    customFields: dto.customFields ?? null,
    comments: dto.comments ?? [],
    isArchived: !!dto.isArchived,
    archivedAt: dto.archivedAt ?? null,
    isDeleted: !!dto.isDeleted,
    deletedAt: dto.deletedAt ?? null,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

// `/projects` defaults to `limit=50` server-side and, for non-owners, filters "mine" AFTER paginating (so its `total` and
// page boundaries can't be trusted for a page-walk loop). A bare call silently showed only the first 50 projects — and every
// KPI/analytics built on them — so ask for everything in one go, matching the website's numbers.
const PROJECTS_LIMIT = 2000;

export async function fetchProjects(params?: { status?: ProjectStatus; archived?: boolean; deleted?: boolean }) {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.archived) search.set('archived', 'true');
  if (params?.deleted) search.set('deleted', 'true');
  search.set('limit', String(PROJECTS_LIMIT));
  const res = await api.get<{ total: number; items: ProjectDto[] }>(`/projects?${search}`);
  return { total: res.data.total, items: res.data.items.map(mapProject) };
}

/** Archive is a business-status flag (excluded from active lists/analytics) — separate from
 * trash, which is the soft-delete/restore/permanent-delete lifecycle below. */
export async function archiveProject(id: string): Promise<void> {
  await api.patch(`/projects/${id}/archive`);
}
export async function unarchiveProject(id: string): Promise<void> {
  await api.patch(`/projects/${id}/unarchive`);
}

/** `DELETE /projects/:id` is a soft-delete (moves to trash, restorable) — the real permanent
 * delete is the separate `/permanent` route. There is no auto-purge job on the backend, so
 * unlike the design mockup, trashed projects do NOT expire after any fixed number of days. */
export async function moveProjectToTrash(id: string): Promise<void> {
  await api.delete(`/projects/${id}`);
}
export async function restoreProject(id: string): Promise<void> {
  await api.patch(`/projects/${id}/restore`);
}
export async function permanentlyDeleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}/permanent`);
}
export async function emptyProjectsTrash(): Promise<void> {
  await api.delete('/projects/trash/empty');
}

export async function fetchProject(id: string): Promise<Project> {
  const res = await api.get<ProjectDto>(`/projects/${id}`);
  return mapProject(res.data);
}

export interface UpdateProjectDto {
  id: string;
  name?: string;
  description?: string;
  /** Decimal string ("11000.00") — same as the create payload. */
  amount?: string;
  currency?: string;
  category?: string;
  /** Comma-separated ("CRM,IT,WEB") — the backend DTO takes tags as a string, unlike the stored array. */
  tags?: string;
  ownerName?: string;
  ownerUserIds?: string[];
  leadId?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  relatedProjectIds?: string[];
  briefFileName?: string | null;
  briefFileUrl?: string | null;
  customFields?: Record<string, any>;
  comments?: EntityComment[];
  tasks?: ProjectTask[];
}

export async function updateProject(payload: UpdateProjectDto): Promise<Project> {
  const { id, ...body } = payload;
  const res = await api.patch<ProjectDto>(`/projects/${id}`, body);
  return mapProject(res.data);
}

/** Dedicated PATCH /projects/:id/status — logs a real `status_change` activity entry, unlike a
 * generic field PATCH. Use this instead of `updateProject` when only the status is changing. */
export async function updateProjectStatus(id: string, status: ProjectStatus): Promise<Project> {
  const res = await api.patch<ProjectDto>(`/projects/${id}/status`, { status });
  return mapProject(res.data);
}

export interface CreateProjectPayload {
  name: string;
  amount: string;
  status: ProjectStatus;
  currency?: string;
  category?: string;
  tags?: string;
  ownerName?: string;
  ownerUserIds?: string[];
  leadId?: string;
  description?: string;
  companyId?: string;
  contactId?: string;
}

export async function createProject(payload: CreateProjectPayload): Promise<void> {
  await api.post('/projects', payload);
}

export type ProjectActivityAction = 'create' | 'update' | 'status_change' | 'archive' | 'unarchive' | 'delete' | 'restore';

export interface ProjectActivityEntry {
  id: string;
  action: ProjectActivityAction | string;
  actorName: string | null;
  actorEmail: string | null;
  payload: Record<string, any> | null;
  createdAt: string;
}

export async function fetchProjectActivity(id: string): Promise<ProjectActivityEntry[]> {
  const res = await api.get<ProjectActivityEntry[]>(`/projects/${id}/activities`);
  return res.data;
}
