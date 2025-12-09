// src/pages/projects/projectTypes.ts

// Статусы должны совпадать с бэкендом (ProjectStatus)
export type ProjectStatus =
  | 'Новый'
  | 'В работе'
  | 'На проверке'
  | 'Заморожен'
  | 'Закрыт';

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
  ownerUserId?: string | null;
  briefFileName?: string | null;
  briefFileUrl?: string | null;
  tasks: ProjectTask[];
  comments: ProjectComment[];
  createdAt: string;         // уже отформатированная дата
  updatedAt?: string;
}

// Задачи / чеклист / комментарии пока живут только на фронте
export type TaskStatus = 'К выполнению' | 'В работе' | 'Готово';
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
}

// В справочниках пока просто константы
export const PROJECT_CATEGORIES = ['Аналитика', 'Разработка', 'Маркетинг'];
export const PROJECT_TAGS = ['CRM', 'IT', 'WEB'];

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
    leadId: null,
    leadName: null,
    leadEmail: null,
    createdAt: '',
    tasks: [],
    comments: [], 
  };
}