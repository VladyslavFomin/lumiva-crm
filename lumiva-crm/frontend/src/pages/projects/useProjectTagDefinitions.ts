// src/pages/projects/useProjectTagDefinitions.ts
import { useCallback, useEffect, useState } from 'react';
import {
  fetchProjectTagDefinitions,
  type ProjectTagDefinition,
} from '../../api/project-tags';

export function useProjectTagDefinitions() {
  const [tags, setTags] = useState<ProjectTagDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const list = await fetchProjectTagDefinitions();
      setTags([...list].sort((a, b) => a.order - b.order));
    } catch (e) {
      console.error('Ошибка загрузки меток проектов:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await fetchProjectTagDefinitions();
        if (!alive) return;
        setTags([...list].sort((a, b) => a.order - b.order));
      } catch (e) {
        console.error('Ошибка загрузки меток проектов:', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const colorFor = useCallback(
    (value: string) => tags.find((t) => t.value === value)?.color ?? '#777777',
    [tags],
  );

  return { tags, loading, reload, colorFor };
}
