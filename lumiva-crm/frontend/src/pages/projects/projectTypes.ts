// src/pages/projects/projectTypes.ts

// Статусы настраиваются тенантом (см. api/project-statuses.ts / useProjectStatuses) —
// 7 базовых значений остаются как смысловой якорь для типовых меток/цветов-фолбэков,
// но реальный набор значений динамический, поэтому тип — string.
export type ProjectStatus = string;
export const BUILT_IN_PROJECT_STATUS_VALUES = [
  'Новый',
  'В работе',
  'На проверке',
  'Заморожен',
  'Закрыт',
  'Выиграно',
  'Проиграно',
] as const;

export type ProjectFileProvider = 'google_drive' | 'onedrive' | 'other';

export interface ProjectFileLink {
  id: string;
  label: string;
  url: string;
  provider: ProjectFileProvider;
  createdAt: string;
}

// Фронтовый тип проекта — уже «удобный» для UI
export interface Project {
  id: string;
  name: string;
  description: string;
  amount: number;            // число для удобства
  currency: string;
  status: ProjectStatus;
  category: string | null;
  tags: string[];
  owner: string | null;      // ответственный
  leadId: string | null;
  leadName: string | null;
  leadEmail: string | null;
  /** Привязка к компании (с бэка; может задаваться с лидом). */
  companyId?: string | null;
  /** Название компании лида (если есть на бэке / в списке). */
  companyName?: string | null;
  /** Привязанный контакт. */
  contactId?: string | null;
  ownerUserId?: string | null;
  ownerUserIds?: string[] | null;
  briefFileName?: string | null;
  briefFileUrl?: string | null;
  files?: ProjectFileLink[] | null;
  customFields?: Record<string, any> | null;
  tasks: ProjectTask[];
  comments: ProjectComment[];
  createdAt: string;         // уже отформатированная дата
  updatedAt?: string;
  isArchived?: boolean;
  isDeleted?: boolean;
  archivedAt?: string | null;
  deletedAt?: string | null;
}

// Задачи / чеклист / комментарии пока живут только на фронте
export type TaskStatus =
  | 'К выполнению'
  | 'В работе'
  | 'На проверке'
  | 'Заблокировано'
  | 'Отложено'
  | 'Готово';
export type TaskPriority = 'Обычный' | 'Высокий' | 'Низкий';

export interface ProjectTaskChecklistItem {
  id: string;
  title: string;
  done: boolean;
  doneBy?: string;
  doneAt?: string;
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

export interface ProjectComment {
  id: string;
  author: string;
  createdAt: string;
  text: string;
  mentions?: string[];
  parentId?: string | null;
  likedBy?: string[];
}

// В справочниках пока просто константы
export const PROJECT_CATEGORIES = ['Аналитика', 'Разработка', 'Маркетинг', 'Реклама', 'SEO', 'SMM'];

// Пустой проект для "Новый проект"
export function createEmptyProject(): Project {
  return {
    id: 'new',
    name: '',
    description: '',
    amount: 0,
    currency: 'EUR',
    status: 'Новый',
    category: null,
    tags: [],
    owner: null,
    ownerUserIds: [],
    leadId: null,
    leadName: null,
    leadEmail: null,
    companyId: null,
    companyName: null,
    contactId: null,
    customFields: {},
    files: [],
    createdAt: '',
    tasks: [],
    comments: [],
  };
}
