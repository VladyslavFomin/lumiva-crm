import React, { useEffect, useRef, useState } from 'react';

/** Тело блока аналитики на главной: меряет доступную высоту ячейки и отдаёт её рендеру блока,
 * чтобы блок занял ячейку так же, как карточку на странице аналитики. */
export const EmbedBody: React.FC<{ children: (height: number) => React.ReactNode }> = ({ children }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => setHeight(Math.round(el.getBoundingClientRect().height));
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="h-full min-h-[160px] w-full overflow-hidden text-[#222]">
      {height > 0 ? children(height) : null}
    </div>
  );
};

/** Высота шапки карточки блока на страницах аналитики (p-4 + заголовок + mb-3): рендер блока
 * вычитает её сам, поэтому на главной передаём «высоту целой карточки» = тело + шапка. */
export const BLOCK_CHROME_HEIGHT = 64;

/** Что кладём в пресет главной вместе с блоком, чтобы нарисовать его тем же кодом, что в аналитике. */
export type NativeAnalyticsPin = {
  nativeBlock?: unknown;
  nativePeriod?: string;
  nativeFilters?: unknown[];
};
