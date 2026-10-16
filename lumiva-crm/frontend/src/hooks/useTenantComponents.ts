import { useEffect, useState } from 'react';
import { fetchTenantComponents, type TenantComponent } from '../api/tenants';
import { getSession } from '../auth/session';

const componentsCache = new Map<string, TenantComponent[]>();
const componentsRequests = new Map<string, Promise<TenantComponent[]>>();

export function useTenantComponents() {
  const tenantKey = getSession()?.tenantId ?? 'current';
  const [components, setComponents] = useState<TenantComponent[]>(componentsCache.get(tenantKey) ?? []);
  const [loaded, setLoaded] = useState(componentsCache.has(tenantKey));

  useEffect(() => {
    let active = true;
    const cached = componentsCache.get(tenantKey);
    if (cached) {
      setComponents(cached);
      setLoaded(true);
      return () => { active = false; };
    }

    let request = componentsRequests.get(tenantKey);
    if (!request) {
      request = fetchTenantComponents()
        .then((result) => {
          componentsCache.set(tenantKey, result);
          return result;
        })
        .finally(() => {
          componentsRequests.delete(tenantKey);
        });
      componentsRequests.set(tenantKey, request);
    }

    request
      .then((result) => {
        if (!active) return;
        setComponents(result);
        setLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setComponents([]);
        setLoaded(true);
      });

    return () => { active = false; };
  }, [tenantKey]);

  const isEnabled = (key: string) => {
    if (!loaded) return false;
    return components.find((component) => component.key === key)?.enabled ?? true;
  };

  return { components, loaded, isEnabled };
}