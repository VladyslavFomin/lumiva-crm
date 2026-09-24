// Единый список задач компании: собственные задачи компании + задачи её проектов + чек-листы её лидов.
// «Её» проекты/лиды — то же объединение, что в аналитике компании на бэкенде: прямая привязка к
// компании, привязка через контакт компании, проект — ещё и через лид компании. Данные приходят из
// уже загруженных (и уже отфильтрованных бэкендом по правам доступа) списков лидов/проектов.
import type { TFunction } from 'i18next';
import type { CompanyTask } from '../../api/companies';
import type { Contact } from '../../api/contacts';
import { isLeadInTrash, type Lead } from '../../api/leads';
import type { Project } from '../../api/projects';
import type { StaffUser } from '../../api/staff';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TaskSource = 'company' | 'project' | 'lead';
export type TaskColumn = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface UnifiedTask {
  key: string;
  source: TaskSource;
  /** id проекта/лида, откуда задача (для company — null: задача принадлежит самой компании). */
  sourceId: string | null;
  sourceName: string | null;
  title: string;
  description: string | null;
  column: TaskColumn;
  /** Отображаемый статус (у проектов бывают «Заблокировано»/«Отложено» — колонка «К выполнению», но метка своя). */
  statusLabel: string;
  priority: TaskPriority | null;
  due: string | null;
  overdue: boolean;
  assignees: string[];
  checklist: { done: number; total: number } | null;
  tags: string[];
}

const COLUMN_KEY: Record<TaskColumn, string> = {
  todo: 'crm.companies.card.taskCols.todo',
  in_progress: 'crm.companies.card.taskCols.inProgress',
  review: 'crm.companies.card.taskCols.review',
  done: 'crm.companies.card.taskCols.done',
};

const PROJECT_PRIORITY: Record<string, TaskPriority> = {
  Низкий: 'low',
  Обычный: 'medium',
  Высокий: 'high',
};

const isOverdue = (due: string | null, column: TaskColumn) => {
  if (!due || column === 'done') return false;
  const d = new Date(due);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
};

const asPriority = (p?: string | null): TaskPriority | null =>
  p === 'low' || p === 'medium' || p === 'high' || p === 'urgent' ? p : null;

function projectColumn(status: string, t: TFunction): { column: TaskColumn; label: string } {
  const s = (status || '').trim();
  switch (s) {
    case 'В работе':
      return { column: 'in_progress', label: t(COLUMN_KEY.in_progress) };
    case 'На проверке':
      return { column: 'review', label: t(COLUMN_KEY.review) };
    case 'Готово':
      return { column: 'done', label: t(COLUMN_KEY.done) };
    case 'Заблокировано':
      return { column: 'todo', label: t('crm.companies.card.tasksTab.statusBlocked') };
    case 'Отложено':
      return { column: 'todo', label: t('crm.companies.card.tasksTab.statusDeferred') };
    case 'К выполнению':
    case '':
      return { column: 'todo', label: t(COLUMN_KEY.todo) };
    default:
      if (/^(выполнено|done|completed)$/i.test(s)) return { column: 'done', label: t(COLUMN_KEY.done) };
      return { column: 'todo', label: s };
  }
}

export function buildUnifiedTasks(
  args: {
    companyId: string;
    tasks: CompanyTask[];
    leads: Lead[];
    projects: Project[];
    contacts: Contact[];
    staff: StaffUser[];
  },
  t: TFunction,
): UnifiedTask[] {
  const { companyId, tasks, leads, projects, contacts, staff } = args;
  const staffName = new Map(staff.map((s) => [s.id, s.fullName]));
  // В задачах проекта исполнители хранятся как id сотрудников (у старых данных — просто имена)
  const resolveAssignees = (list: string[] | undefined) =>
    (list || []).flatMap((a) => {
      const name = staffName.get(a);
      if (name) return [name];
      return UUID_RE.test(a) ? [] : [a];
    });
  const out: UnifiedTask[] = [];

  // 1) собственные задачи компании (отменённые в доске не показываем — как и раньше)
  for (const tk of tasks) {
    if (tk.status === 'cancelled') continue;
    const column = tk.status as TaskColumn;
    out.push({
      key: `company:${tk.id}`,
      source: 'company',
      sourceId: null,
      sourceName: null,
      title: tk.title,
      description: tk.description || null,
      column,
      statusLabel: t(COLUMN_KEY[column] ?? COLUMN_KEY.todo),
      priority: asPriority(tk.priority),
      due: tk.dueDate,
      overdue: isOverdue(tk.dueDate, column),
      assignees: tk.assignedTo ? [tk.assignedTo] : [],
      checklist: null,
      tags: tk.tags || [],
    });
  }

  const contactIds = new Set(contacts.map((c) => c.id));
  const companyLeads = leads.filter(
    (l) => !isLeadInTrash(l) && (l.companyId === companyId || (l.contactId && contactIds.has(l.contactId))),
  );
  const leadIds = new Set(companyLeads.map((l) => l.id));

  // 2) задачи проектов компании
  const companyProjects = projects.filter(
    (p) =>
      !p.isArchived &&
      !p.isDeleted &&
      (p.companyId === companyId ||
        (p.leadId && leadIds.has(p.leadId)) ||
        (p.contactId && contactIds.has(p.contactId))),
  );
  for (const p of companyProjects) {
    for (const [i, tk] of (p.tasks || []).entries()) {
      const { column, label } = projectColumn(tk.status, t);
      const total = tk.checklist?.length || 0;
      out.push({
        key: `project:${p.id}:${tk.id || i}`,
        source: 'project',
        sourceId: p.id,
        sourceName: p.name,
        title: tk.title || '—',
        description: null,
        column,
        statusLabel: label,
        priority: PROJECT_PRIORITY[tk.priority] ?? null,
        due: tk.deadline || null,
        overdue: isOverdue(tk.deadline || null, column),
        assignees: resolveAssignees(tk.assignees),
        checklist: total ? { done: tk.checklist.filter((c) => c.done).length, total } : null,
        tags: [],
      });
    }
  }

  // 3) шаги (чек-лист) лидов компании
  for (const l of companyLeads) {
    for (const [i, tk] of (l.tasks || []).entries()) {
      const column: TaskColumn = tk.done ? 'done' : 'todo';
      out.push({
        key: `lead:${l.id}:${tk.id || i}`,
        source: 'lead',
        sourceId: l.id,
        sourceName: l.name,
        title: tk.title || '—',
        description: null,
        column,
        statusLabel: t(COLUMN_KEY[column]),
        priority: null,
        due: tk.deadline || null,
        overdue: isOverdue(tk.deadline || null, column),
        assignees: [],
        checklist: null,
        tags: [],
      });
    }
  }

  // в колонке: сначала просроченные, затем по сроку, без срока — в конце
  return out.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const da = a.due ? new Date(a.due).getTime() : Infinity;
    const db = b.due ? new Date(b.due).getTime() : Infinity;
    return (Number.isNaN(da) ? Infinity : da) - (Number.isNaN(db) ? Infinity : db);
  });
}
