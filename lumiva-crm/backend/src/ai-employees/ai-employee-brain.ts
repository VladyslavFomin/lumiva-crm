import type { AiAgent } from './ai-agent.entity';

/**
 * «Мозг» ИИ-сотрудника — его личная папка файлов (md-документы и загруженные файлы), которую он
 * читает перед КАЖДЫМ действием, и куда сам дописывает выводы (brain_write). Плюс связка с «Мозгом»
 * ИИ-офиса: сотрудник читает папки отделов, которые курирует или к которым его подключили, и может
 * записывать туда.
 *
 * Сами файлы живут в ai_brain_files (agent_id = сотрудник) — тот же движок индексации и поиска,
 * что у офиса. AiEmployeesModule не зависит от AiOfficeModule: реализацию регистрирует
 * AiEmployeeBrainService (модуль офиса) при старте — как OfficeHooks.
 */
export type EmployeeBrainContext = {
  /** Готовый блок для промпта (пустая строка — мозг пуст). */
  block: string;
  /** Прочитанные файлы — для «Последнее чтение» и журнала. */
  fileIds: string[];
  /** Куда сотрудник может писать через brain_write: 'own' + id отделов. */
  writeTargets: Array<{ id: string; name: string }>;
  /** Сотруднику разрешено записывать в мозг. */
  canWrite: boolean;
};

export type EmployeeBrainWrite = { title?: unknown; contentMd?: unknown; target?: unknown };

export interface EmployeeBrainHooks {
  /**
   * Что сотрудник читает перед действием. clientFacing — ответ клиенту (консультант): без собственных
   * заметок ИИ и без журналов отделов, только файлы людей.
   */
  contextFor(
    tenantId: string,
    agent: AiAgent,
    query: string,
    opts?: { clientFacing?: boolean; dryRun?: boolean },
  ): Promise<EmployeeBrainContext>;
  /** Исполнение brain_write обычного сотрудника (не агента отдела). */
  write(tenantId: string, agent: AiAgent, payload: EmployeeBrainWrite): Promise<{ fileName: string; target: string }>;
}

export const BRAIN_WRITE_ACTION = 'brain_write';
