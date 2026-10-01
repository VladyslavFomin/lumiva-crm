import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

/**
 * Caps a list container at its first `visible` rows (measured from the real DOM rows)
 * and lets the rest scroll. The container needs `position: relative` so offsetTop is local.
 */
export function useScrollAfterRows<T extends HTMLElement = HTMLDivElement>(visible: number, deps: unknown) {
  const ref = useRef<T>(null);
  const [maxH, setMaxH] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const box = ref.current;
    const nth = box && box.children.length > visible ? (box.children[visible - 1] as HTMLElement) : null;
    setMaxH(nth ? nth.offsetTop + nth.offsetHeight : undefined);
  }, [deps, visible]);

  const style: CSSProperties | undefined = maxH ? { maxHeight: maxH, overflowY: 'auto' } : undefined;
  return { ref, style };
}
