import { useMemo, useState } from 'react';

const WINDOWS: (number | null)[] = [null, 90, 30, 14, 7];

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Discrete zoom levels for date-range drilldown: all-time → 90d → 30d → 14d → 7d. Real refetch-driving state, not a purely visual zoom.
 * Defaults to the 90d window (index 1), not all-time (index 0) — a real tenant can have 600+ distinct
 * traffic days, which the line chart can't usefully render and which makes the daily-series query far
 * heavier than it needs to be for the default view. All-time is still reachable via zoomOut(). */
export function useDateDrilldown() {
  const [levelIdx, setLevelIdx] = useState(1);
  const windowDays = WINDOWS[levelIdx];

  const { from, to } = useMemo(() => {
    if (windowDays == null) return { from: undefined as string | undefined, to: undefined as string | undefined };
    const toD = new Date();
    const fromD = new Date(toD.getTime() - windowDays * 86400000);
    return { from: fmt(fromD), to: fmt(toD) };
  }, [windowDays]);

  return {
    from,
    to,
    windowDays,
    canZoomIn: levelIdx < WINDOWS.length - 1,
    canZoomOut: levelIdx > 0,
    zoomIn: () => setLevelIdx((i) => Math.min(WINDOWS.length - 1, i + 1)),
    zoomOut: () => setLevelIdx((i) => Math.max(0, i - 1)),
    label: windowDays == null ? 'Весь период' : `${windowDays} дн.`,
  };
}
