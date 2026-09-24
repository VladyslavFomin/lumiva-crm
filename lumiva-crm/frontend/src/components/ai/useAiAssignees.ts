import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAiAssignmentsBatch, type AiAssignableEntityType, type AiAssignee } from '../../api/aiEmployees';

export const AI_ASSIGNMENTS_CHANGED = 'lumiva-ai-assignments-changed';

/** Сообщает спискам, что назначения ИИ изменились (AiAssigneeGroup) — чипы в таблицах обновятся без перезагрузки. */
export function notifyAiAssignmentsChanged() {
  window.dispatchEvent(new Event(AI_ASSIGNMENTS_CHANGED));
}

/**
 * Кто из ИИ-сотрудников ответственный за записи, видимые в таблице. Один пакетный запрос на набор id;
 * ошибка/нет доступа к ИИ — просто пустая карта (таблица выглядит как раньше).
 */
export function useAiAssignees(entityType: AiAssignableEntityType, ids: string[]): Record<string, AiAssignee[]> {
  const [map, setMap] = useState<Record<string, AiAssignee[]>>({});
  const [tick, setTick] = useState(0);
  const key = useMemo(() => [...new Set(ids)].sort().join(','), [ids]);

  useEffect(() => {
    const onChange = () => setTick((t) => t + 1);
    window.addEventListener(AI_ASSIGNMENTS_CHANGED, onChange);
    return () => window.removeEventListener(AI_ASSIGNMENTS_CHANGED, onChange);
  }, []);

  const load = useCallback(async () => {
    const list = key ? key.split(',') : [];
    if (!list.length) {
      setMap({});
      return;
    }
    try {
      const res = await fetchAiAssignmentsBatch(entityType, list);
      setMap(res.items || {});
    } catch {
      setMap({});
    }
  }, [entityType, key]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(id);
  }, [load, tick]);

  return map;
}
