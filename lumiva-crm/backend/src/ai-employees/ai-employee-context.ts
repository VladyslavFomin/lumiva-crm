import { AsyncLocalStorage } from 'async_hooks';

/**
 * Помечает цепочку вызовов как «действие ИИ-сотрудника». Изменения, которые ИИ вносит в CRM
 * (статус лида, заметка, задача, назначение), сами порождают события автоматизаций — без этой
 * метки ИИ реагировал бы на собственные действия по кругу. Диспетчер триггеров пропускает
 * события, возникшие внутри такой цепочки.
 */
const storage = new AsyncLocalStorage<{ agentId: string }>();

export function runAsAiActor<T>(agentId: string, fn: () => Promise<T>): Promise<T> {
  return storage.run({ agentId }, fn);
}

export function currentAiActor(): { agentId: string } | undefined {
  return storage.getStore();
}
