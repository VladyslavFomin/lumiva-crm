// src/pages/projects/useProjectStatuses.ts
import { useCallback, useEffect, useState } from 'react';
import {
  fetchProjectStatuses,
  type ProjectStatusDefinition,
} from '../../api/project-statuses';

/** Цвета для встроенных статусов — используются как мгновенный фолбэк до того,
 * как подгрузится реальный (настраиваемый) список с бэкенда, чтобы не было мигания. */
const BUILT_IN_FALLBACK_COLORS: Record<string, string> = {
  Новый: '#1769d1',
  'В работе': '#3b6cb6',
  'На проверке': '#c08319',
  Заморожен: '#777777',
  Закрыт: '#9a9a9a',
  Выиграно: '#1f8a5e',
  Проиграно: '#cc2f47',
};

/** Разворачивает один hex-цвет статуса в набор pill-стилей (светлый фон, тёмный текст, точка) —
 * единая формула для встроенных и добавленных тенантом статусов, чтобы у произвольного цвета
 * тоже была аккуратная бейдж-заливка, а не голый акцент. */
export function pillStyleFromHex(hex: string): {
  background: string;
  color: string;
  borderColor: string;
  dot: string;
} {
  const clean = hex.replace('#', '');
  const valid = /^[0-9a-fA-F]{6}$/.test(clean) ? clean : '777777';
  const r = parseInt(valid.substring(0, 2), 16);
  const g = parseInt(valid.substring(2, 4), 16);
  const b = parseInt(valid.substring(4, 6), 16);
  const mix = (channel: number, target: number, amount: number) =>
    Math.round(channel + (target - channel) * amount);
  const background = `rgb(${mix(r, 255, 0.88)}, ${mix(g, 255, 0.88)}, ${mix(b, 255, 0.88)})`;
  const borderColor = `rgb(${mix(r, 255, 0.7)}, ${mix(g, 255, 0.7)}, ${mix(b, 255, 0.7)})`;
  const color = `rgb(${mix(r, 0, 0.35)}, ${mix(g, 0, 0.35)}, ${mix(b, 0, 0.35)})`;
  return { background, color, borderColor, dot: `#${valid}` };
}

export function useProjectStatuses() {
  const [statuses, setStatuses] = useState<ProjectStatusDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const list = await fetchProjectStatuses();
      setStatuses([...list].sort((a, b) => a.order - b.order));
    } catch (e) {
      console.error('Ошибка загрузки статусов проектов:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await fetchProjectStatuses();
        if (!alive) return;
        setStatuses([...list].sort((a, b) => a.order - b.order));
      } catch (e) {
        console.error('Ошибка загрузки статусов проектов:', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const colorFor = useCallback(
    (value: string) => {
      const found = statuses.find((s) => s.value === value);
      return found?.color ?? BUILT_IN_FALLBACK_COLORS[value] ?? '#777777';
    },
    [statuses],
  );

  return { statuses, loading, reload, colorFor };
}
