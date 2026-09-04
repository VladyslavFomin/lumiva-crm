// src/pages/projects/useProjectCurrencyDefinitions.ts
import { useCallback, useEffect, useState } from 'react';
import {
  fetchProjectCurrencyDefinitions,
  type ProjectCurrencyDefinition,
} from '../../api/project-currencies';

export function useProjectCurrencyDefinitions() {
  const [currencies, setCurrencies] = useState<ProjectCurrencyDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await fetchProjectCurrencyDefinitions();
        if (!alive) return;
        setCurrencies([...list].sort((a, b) => a.order - b.order));
      } catch (e) {
        console.error('Ошибка загрузки валют проектов:', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const defaultCode = useCallback(
    () => currencies.find((c) => c.isDefault)?.code ?? currencies[0]?.code ?? 'EUR',
    [currencies],
  );

  return { currencies, loading, defaultCode };
}
