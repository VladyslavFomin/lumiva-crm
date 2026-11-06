import { useEffect, useState } from 'react';
import { DEFAULT_CRM_LAYOUT, fetchCrmLayout, type CrmLayout } from '../api/crmLayout';
import { getSession } from '../auth/session';

export type CrmEntity = 'lead' | 'project' | 'deal';

const cache = new Map<string, CrmLayout>();
const inflight = new Map<string, Promise<CrmLayout>>();
const listeners = new Set<(l: CrmLayout) => void>();

/** Обновить кэш после сохранения в Настройках — открытые карточки сразу перестраиваются. */
export function setCrmLayoutCache(layout: CrmLayout) {
  cache.set(getSession()?.tenantId ?? 'current', layout);
  listeners.forEach((fn) => fn(layout));
}

/** Структура CRM компании; пока не загружена — всё включено (как раньше). */
export function useCrmLayout(): { layout: CrmLayout; loaded: boolean } {
  const key = getSession()?.tenantId ?? 'current';
  const [layout, setLayout] = useState<CrmLayout>(cache.get(key) ?? DEFAULT_CRM_LAYOUT);
  const [loaded, setLoaded] = useState(cache.has(key));
  useEffect(() => {
    let alive = true;
    const on = (l: CrmLayout) => alive && setLayout(l);
    listeners.add(on);
    if (!cache.has(key)) {
      let req = inflight.get(key);
      if (!req) {
        req = fetchCrmLayout()
          .then((l) => {
            cache.set(key, l);
            return l;
          })
          .finally(() => inflight.delete(key));
        inflight.set(key, req);
      }
      req
        .then((l) => {
          if (!alive) return;
          setLayout(l);
          setLoaded(true);
        })
        .catch(() => alive && setLoaded(true));
    }
    return () => {
      alive = false;
      listeners.delete(on);
    };
  }, [key]);
  return { layout, loaded };
}
