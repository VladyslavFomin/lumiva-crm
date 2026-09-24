// Общий движок «перетащить / растянуть блок» для сеток из 12 колонок (главная, аналитика
// проектов / рабочих областей / клиентов, лиды, продажи, товары).
//
// Раньше у каждой страницы был свой: на HTML5 drag-and-drop (без живого перестроения, с
// призраком-скриншотом), с шагом ширины «пиксели / 6» или фиксированные 120 px и набором
// допустимых ширин {3,4,6,8,12}. Здесь всё считается от реальной ширины колонки сетки, поэтому
// край блока идёт ровно за курсором и «прилипает» к колонке, а не скачет.
//
//  - resize: ширина — любое целое число колонок [minSpan..maxSpan], высота — свободно в px;
//    во время жеста живые размеры лежат в `live`, наверх (onResizeCommit) уходят один раз при отпускании.
//  - drag: блок «выдёргивается» из сетки (у страницы он рисуется пунктирной заглушкой), за курсором
//    едет плавающая копия, остальные блоки перестраиваются вживую (`previewOrder`), у края окна
//    включается автоскролл. Esc — отмена.
//  - pointer events → работает и с тачем (ручки должны иметь `touch-action: none`).
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';

export type BlockResizeAxis = 'x' | 'y' | 'both';
export interface BlockMetrics {
  span: number;
  height: number;
}

export type BlockLive = (BlockMetrics & { id: string; axis: BlockResizeAxis }) | null;

/** Внешнее хранилище живых размеров: подписаны только сами блоки, страница целиком не перерисовывается. */
export interface BlockLiveStore {
  get: () => BlockLive;
  subscribe: (fn: () => void) => () => void;
}

function createLiveStore() {
  let value: BlockLive = null;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    subscribe: (fn: () => void) => {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
    set: (next: BlockLive) => {
      value = next;
      subs.forEach((fn) => fn());
    },
  };
}

const NOOP_STORE: BlockLiveStore = { get: () => null, subscribe: () => () => {} };

/** Живые размеры блока `id` из хранилища (для карточки, которая сама себя перерисовывает при растягивании). */
export function useBlockLive(store: BlockLiveStore | undefined, id: string | undefined): BlockLive {
  const s = store ?? NOOP_STORE;
  const value = useSyncExternalStore(s.subscribe, s.get, s.get);
  return value && value.id === id ? value : null;
}

export interface BlockGridOptions {
  /** Контейнер-сетка; прямые потомки-блоки должны нести атрибут data-block-id */
  gridRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  /** Порядок id ВИДИМЫХ блоков в сетке */
  order: string[];
  minSpan?: number;
  maxSpan?: number;
  minHeight?: number | ((id: string) => number);
  maxHeight?: number;
  /** false — `live` в возвращаемом значении не обновляется (страница не перерисовывается на каждый кадр),
   * блоки читают живые размеры через liveStore + useBlockLive. По умолчанию true. */
  reactiveLive?: boolean;
  onResizeCommit: (id: string, metrics: BlockMetrics) => void;
  onReorderCommit: (order: string[]) => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function findScrollParent(node: HTMLElement | null): HTMLElement | null {
  let el = node?.parentElement ?? null;
  while (el && el !== document.body) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) return el;
    el = el.parentElement;
  }
  return null; // окно
}

/** Подставляет новый порядок видимых блоков в полный список, не трогая скрытые/отфильтрованные:
 * они остаются на своих местах, видимые занимают освободившиеся «слоты» по очереди. */
export function applyVisibleOrder(fullIds: string[], newVisibleOrder: string[]): string[] {
  const visible = new Set(newVisibleOrder);
  let i = 0;
  const next = fullIds.map((id) => (visible.has(id) ? newVisibleOrder[i++] ?? id : id));
  // если в новом порядке остались id, которых не было в полном списке — дописываем в конец
  for (; i < newVisibleOrder.length; i++) if (!next.includes(newVisibleOrder[i])) next.push(newVisibleOrder[i]);
  return next;
}

export function useBlockGridInteractions(options: BlockGridOptions) {
  const optsRef = useRef(options);
  optsRef.current = options;

  const [drag, setDrag] = useState<{ id: string; order: string[] } | null>(null);
  const [live, setLiveState] = useState<BlockLive>(null);
  const storeRef = useRef<ReturnType<typeof createLiveStore> | undefined>(undefined);
  if (!storeRef.current) storeRef.current = createLiveStore();
  const setLive = useCallback((next: BlockLive) => {
    storeRef.current!.set(next);
    if (optsRef.current.reactiveLive !== false) setLiveState(next);
  }, []);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);
  useEffect(() => {
    if (!options.enabled) cleanupRef.current?.();
  }, [options.enabled]);

  const beginResize = useCallback(
    (
      e: ReactPointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
      id: string,
      axis: BlockResizeAxis,
      current: BlockMetrics,
    ) => {
      const o = optsRef.current;
      const grid = o.gridRef.current;
      if (!o.enabled || !grid || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      cleanupRef.current?.();

      const rect = grid.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
      // шаг одной колонки = ширина колонки + зазор
      const colStep = (rect.width + gap) / 12;
      const minSpan = o.minSpan ?? 3;
      const maxSpan = o.maxSpan ?? 12;
      const minHeight = typeof o.minHeight === 'function' ? o.minHeight(id) : o.minHeight ?? 100;
      const maxHeight = o.maxHeight ?? 1400;
      const startX = e.clientX;
      const startY = e.clientY;
      // ручку могут «унести» ре-рендером — слушаем окно, не элемент
      let last: BlockMetrics = { span: current.span, height: current.height };
      let pending: PointerEvent | null = null;
      let raf = 0;

      setLive({ id, axis, ...last });
      const prevCursor = document.body.style.cursor;
      const prevSelect = document.body.style.userSelect;
      document.body.style.cursor = axis === 'y' ? 'ns-resize' : axis === 'both' ? 'nwse-resize' : 'ew-resize';
      document.body.style.userSelect = 'none';

      const apply = () => {
        raf = 0;
        const ev = pending;
        if (!ev) return;
        let span = current.span;
        let height = current.height;
        if (axis !== 'y') span = clamp(Math.round(current.span + (ev.clientX - startX) / colStep), minSpan, maxSpan);
        if (axis !== 'x') height = clamp(Math.round(current.height + (ev.clientY - startY)), minHeight, maxHeight);
        if (span !== last.span || height !== last.height) {
          last = { span, height };
          setLive({ id, axis, span, height });
        }
      };
      const onMove = (ev: PointerEvent) => {
        pending = ev;
        if (!raf) raf = requestAnimationFrame(apply);
      };
      const teardown = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('keydown', onKey);
        if (raf) cancelAnimationFrame(raf);
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevSelect;
        cleanupRef.current = null;
        setLive(null);
      };
      function onUp() {
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
        apply();
        const final = last;
        // сначала сохраняем, потом гасим live — иначе блок на кадр вернётся к старому размеру
        if (final.span !== current.span || final.height !== current.height) {
          optsRef.current.onResizeCommit(id, final);
        }
        teardown();
      }
      function onCancel() {
        teardown();
      }
      function onKey(ev: KeyboardEvent) {
        if (ev.key === 'Escape') teardown();
      }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('keydown', onKey);
      cleanupRef.current = teardown;
    },
    [],
  );

  const beginDrag = useCallback((e: ReactPointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>, id: string) => {
    const o = optsRef.current;
    const grid = o.gridRef.current;
    if (!o.enabled || !grid || e.button !== 0) return;
    const source = grid.querySelector<HTMLElement>(`:scope > [data-block-id="${id.replace(/"/g, '\\"')}"]`);
    if (!source) return;
    e.preventDefault();
    e.stopPropagation();
    cleanupRef.current?.();

    const rect = source.getBoundingClientRect();
    const offX = e.clientX - rect.left;
    const offY = e.clientY - rect.top;

    // плавающая копия блока (снимается ДО того, как страница нарисует на его месте заглушку)
    const ghost = source.cloneNode(true) as HTMLElement;
    ghost.removeAttribute('data-block-id');
    Object.assign(ghost.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: '0',
      zIndex: '10500',
      pointerEvents: 'none',
      opacity: '0.92',
      transformOrigin: `${offX}px ${offY}px`,
      transform: `translate(${rect.left}px, ${rect.top}px) scale(1.015)`,
      boxShadow: '0 24px 60px rgba(15,23,42,0.22)',
      borderRadius: '18px',
      transition: 'box-shadow .15s',
    } as Partial<CSSStyleDeclaration>);
    // внутри .px-scope, если он есть: часть стилей (главная) привязана к этому корню
    (grid.closest('.px-scope') ?? document.body).appendChild(ghost);

    let curOrder = [...o.order];
    let pointer = { x: e.clientX, y: e.clientY };
    let lastSwap = { t: 0, x: e.clientX, y: e.clientY };
    let raf = 0;
    const scroller = findScrollParent(grid);

    setDrag({ id, order: curOrder });
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    const evaluate = () => {
      ghost.style.transform = `translate(${pointer.x - offX}px, ${pointer.y - offY}px) scale(1.015)`;
      const { x, y } = pointer;
      const nodes = Array.from(grid.querySelectorAll<HTMLElement>(':scope > [data-block-id]'));
      let target: string | null = null;
      let minTop = Infinity;
      let maxBottom = -Infinity;
      for (const n of nodes) {
        const r = n.getBoundingClientRect();
        minTop = Math.min(minTop, r.top);
        maxBottom = Math.max(maxBottom, r.bottom);
        const bid = n.dataset.blockId as string;
        if (bid === id || target) continue;
        // берём только центральную зону блока: у краёв перестройка не срабатывает — иначе блоки
        // «дрожат», когда после перестановки под курсором оказывается уже другой блок
        const zx = r.width * 0.2;
        const zy = r.height * 0.2;
        if (x >= r.left + zx && x <= r.right - zx && y >= r.top + zy && y <= r.bottom - zy) target = bid;
      }
      if (!target && nodes.length > 1) {
        // ниже всех блоков — в конец, выше всех — в начало
        if (y > maxBottom + 6) target = curOrder[curOrder.length - 1];
        else if (y < minTop - 6) target = curOrder[0];
        if (target === id) target = null;
      }
      if (!target) return;
      const now = performance.now();
      const moved = Math.hypot(x - lastSwap.x, y - lastSwap.y);
      if (now - lastSwap.t < 110 || moved < 10) return;
      const from = curOrder.indexOf(id);
      const to = curOrder.indexOf(target);
      if (from < 0 || to < 0 || from === to) return;
      const next = [...curOrder];
      next.splice(from, 1);
      next.splice(to, 0, id);
      curOrder = next;
      lastSwap = { t: now, x, y };
      setDrag({ id, order: next });
    };

    const tick = () => {
      const box = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      const edge = 80;
      let dy = 0;
      if (pointer.y < box.top + edge) dy = -Math.min(26, Math.ceil((box.top + edge - pointer.y) / 3));
      else if (pointer.y > box.bottom - edge) dy = Math.min(26, Math.ceil((pointer.y - (box.bottom - edge)) / 3));
      if (dy) {
        if (scroller) scroller.scrollTop += dy;
        else window.scrollBy(0, dy);
        evaluate(); // под неподвижным курсором проехали другие блоки
      }
      raf = requestAnimationFrame(tick);
    };

    const onMove = (ev: PointerEvent) => {
      pointer = { x: ev.clientX, y: ev.clientY };
      evaluate();
    };
    const teardown = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
      ghost.remove();
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      cleanupRef.current = null;
      setDrag(null);
    };
    function onUp() {
      const changed = curOrder.join('|') !== optsRef.current.order.join('|');
      const final = curOrder;
      teardown();
      if (changed) optsRef.current.onReorderCommit(final);
    }
    function onCancel() {
      teardown();
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') teardown();
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    raf = requestAnimationFrame(tick);
    cleanupRef.current = teardown;
  }, []);

  return {
    beginResize,
    beginDrag,
    /** id блока, который сейчас тащат (для заглушки на его месте) */
    dragId: drag?.id ?? null,
    /** порядок для отрисовки во время перетаскивания, иначе null */
    previewOrder: drag?.order ?? null,
    /** живые размеры блока, который сейчас растягивают, иначе null (только при reactiveLive !== false) */
    live,
    liveStore: storeRef.current as BlockLiveStore,
  };
}
