// Кэш задач проекта в localStorage (тот же ключ, что в ProjectFormPage / MainLayout)
import type { ProjectTask } from './projectTypes';

const tasksCacheKey = (projectId: string) => `project_tasks_${projectId}`;

export function readProjectTasksCache(projectId: string): ProjectTask[] | null {
  try {
    const raw = localStorage.getItem(tasksCacheKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as ProjectTask[];
  } catch {
    return null;
  }
}

export function writeProjectTasksCache(projectId: string, tasks: ProjectTask[]) {
  try {
    localStorage.setItem(tasksCacheKey(projectId), JSON.stringify(tasks));
  } catch {
    // ignore
  }
}
