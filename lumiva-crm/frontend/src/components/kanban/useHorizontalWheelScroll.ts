import { useCallback, useRef } from 'react';

/**
 * A plain vertical mouse-wheel/trackpad gesture over a horizontally-scrolling kanban row does
 * NOT reliably get redirected into horizontal scroll by the browser on its own — that redirect
 * only kicks in for some browsers/inputs and stops working the moment a nested vertical
 * scroll container (a column's card list) sits under the pointer, since it "claims" the wheel
 * event first. So the board would only ever appear to scroll while dnd-kit's own drag
 * auto-scroll is active (a JS-driven scrollLeft, not a real wheel event) — dragging a card
 * "worked" while just looking around did not. This hook makes plain wheel scroll reliable by
 * manually converting vertical wheel delta into horizontal scrollLeft whenever the gesture is
 * predominantly vertical and the row actually has horizontal overflow to scroll.
 *
 * Uses a callback ref, not `useRef` + `useEffect(..., [])` — the board element is only rendered
 * once the page's initial data load finishes (`{!loading && <div ref=... />}`), so a plain effect
 * tied to the *component's* mount would run once, see a still-null ref (the div doesn't exist
 * yet), and never fire again — the listener would silently never attach. A callback ref runs
 * exactly when React attaches/detaches the actual DOM node, whenever that happens.
 *
 * Also uses a real (non-React-synthetic) event listener with { passive: false } — React attaches
 * its own onWheel/onTouchMove delegated listeners as passive since v17, which silently makes
 * event.preventDefault() a no-op inside a plain React onWheel handler.
 */
export function useHorizontalWheelScroll<T extends HTMLElement>() {
  const cleanupRef = useRef<(() => void) | undefined>(undefined);

  const ref = useCallback((el: T | null) => {
    cleanupRef.current?.();
    cleanupRef.current = undefined;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return; // nothing to scroll horizontally
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // already a horizontal gesture — let it pass through natively
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    cleanupRef.current = () => el.removeEventListener('wheel', handleWheel);
  }, []);

  return { ref };
}
