// src/pages/projects/projectTypes.ts

// Статусы должны совпадать с бэкендом (ProjectStatus)
export type ProjectStatus =
  | 'Новый'
  | 'В работе'
  | 'На проверке'
  | 'Заморожен'
  | 'Закрыт'
  | 'Выиграно'
  | 'Проиграно';

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
  /** Название компании лида (если есть на бэке / в списке). */
  companyName?: string | null;
  ownerUserId?: string | null;
  ownerUserIds?: string[] | null;
  briefFileName?: string | null;
  briefFileUrl?: string | null;
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
}

// В справочниках пока просто константы
export const PROJECT_CATEGORIES = ['Аналитика', 'Разработка', 'Маркетинг', 'Реклама', 'SEO', 'SMM'];
export const PROJECT_TAGS = ['CRM', 'IT', 'WEB', 'SEO', 'SMM', 'ADS'];

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
    customFields: {},
    createdAt: '',
    tasks: [],
    comments: [], 
  };
}
