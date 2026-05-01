import { useCallback, useEffect, useRef, useState } from 'react';
import { createColumnDragGhostElement } from './columnDragGhost';

/** Как в WorkspaceTableViewPage: удержание → готовность к drag → ghost preview → drop highlight. */
const HOLD_MS = 500;

let transparentDragCanvas: HTMLCanvasElement | null = null;

function setInvisibleNativeDragImage(dataTransfer: DataTransfer) {
  if (!transparentDragCanvas) {
    transparentDragCanvas = document.createElement('canvas');
    transparentDragCanvas.width = 1;
    transparentDragCanvas.height = 1;
  }
  dataTransfer.setDragImage(transparentDragCanvas, 0, 0);
}

export type WorkspaceColumnDragTheme = 'light' | 'dark';

export type WorkspaceStyleColumnDragOptions = {
  /**
   * Встроенная бирюзовая карточка для setDragImage.
   * На страницах со своим превью (lv-col-ghost) задайте false, чтобы не было двойного ghost.
   */
  useBuiltInDragImage?: boolean;
};

/**
 * Визуал как в WorkspaceTableViewPage: светлые slate, изумрудная цель.
 * Для колонки-источника во время drag — принудительно светлая «заглушка» с гранями,
 * иначе полупрозрачность нативного DnD на тёмном thead даёт «чёрную подложку».
 */
function mergeStateClasses(
  columnId: string,
  holdingKey: string | null,
  dragReadyKey: string | null,
  draggingKey: string | null,
  dragOverKey: string | null,
): string {
  if (draggingKey && dragOverKey === columnId && draggingKey !== columnId) {
    return 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/40';
  }
  if (draggingKey === columnId) {
    return [
      'bg-white !opacity-100',
      'ring-1 ring-slate-300',
      'border border-slate-200',
      'shadow-sm',
    ].join(' ');
  }
  const parts: string[] = [];
  if (holdingKey === columnId) parts.push('bg-slate-50 ring-1 ring-slate-300');
  if (dragReadyKey === columnId) parts.push('bg-slate-100 ring-2 ring-slate-400');
  return parts.filter(Boolean).join(' ');
}

export function useWorkspaceStyleColumnDrag(
  reorder: (dragId: string, targetId: string) => void,
  /** @deprecated Зарезервировано; стили совпадают с рабочей областью для любых таблиц. */
  _theme: WorkspaceColumnDragTheme = 'light',
  options: WorkspaceStyleColumnDragOptions = {},
) {
  const useBuiltInDragImage = options.useBuiltInDragImage !== false;
  const columnHoldTimerRef = useRef<number | null>(null);
  /** Синхронно с DnD (до ре-рендера после onDragStart). */
  const draggingColumnRef = useRef<string | null>(null);
  const [holdingColumnKey, setHoldingColumnKey] = useState<string | null>(null);
  const [dragReadyColumnKey, setDragReadyColumnKey] = useState<string | null>(null);
  const [draggingColumnKey, setDraggingColumnKey] = useState<string | null>(null);
  const [columnDragOverKey, setColumnDragOverKey] = useState<string | null>(null);

  const clearColumnHoldTimer = useCallback(() => {
    if (columnHoldTimerRef.current != null) {
      window.clearTimeout(columnHoldTimerRef.current);
      columnHoldTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearColumnHoldTimer(), [clearColumnHoldTimer]);

  const armColumnDragAfterHold = useCallback(
    (fieldKey: string) => {
      clearColumnHoldTimer();
      setHoldingColumnKey(fieldKey);
      columnHoldTimerRef.current = window.setTimeout(() => {
        setDragReadyColumnKey(fieldKey);
        setHoldingColumnKey(null);
      }, HOLD_MS);
    },
    [clearColumnHoldTimer],
  );

  const disarmColumn = useCallback(
    (fieldKey: string) => {
      clearColumnHoldTimer();
      setHoldingColumnKey((prev) => (prev === fieldKey ? null : prev));
      setDragReadyColumnKey((prev) => (prev === fieldKey ? null : prev));
    },
    [clearColumnHoldTimer],
  );

  const getThProps = useCallback(
    (columnId: string, label: string, baseClassName: string) => {
      const stateClass = mergeStateClasses(
        columnId,
        holdingColumnKey,
        dragReadyColumnKey,
        draggingColumnKey,
        columnDragOverKey,
      );
      const className = [baseClassName, stateClass].filter(Boolean).join(' ');

      return {
        draggable: dragReadyColumnKey === columnId,
        className,
        onMouseDown: (e: React.MouseEvent<HTMLTableCellElement>) => {
          const el = e.target as HTMLElement;
          if (el.closest('button')) return;
          if (el.closest('[data-col-resize]')) return;
          armColumnDragAfterHold(columnId);
        },
        onMouseUp: () => disarmColumn(columnId),
        onMouseLeave: () => disarmColumn(columnId),
        onDragStart: (e: React.DragEvent<HTMLTableCellElement>) => {
          if (dragReadyColumnKey !== columnId) {
            e.preventDefault();
            return;
          }
          draggingColumnRef.current = columnId;
          setDraggingColumnKey(columnId);
          setColumnDragOverKey(null);
          // Нативный DnD часто ставит opacity < 1 на источник — на тёмном thead это «чёрная дыра».
          (e.currentTarget as HTMLElement).style.opacity = '1';
          if (useBuiltInDragImage) {
            const ghost = createColumnDragGhostElement(label);
            document.body.appendChild(ghost);
            e.dataTransfer.setDragImage(ghost, 26, 36);
            requestAnimationFrame(() => ghost.remove());
          } else {
            setInvisibleNativeDragImage(e.dataTransfer);
          }
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', columnId);
        },
        onDragEnd: (e: React.DragEvent<HTMLTableCellElement>) => {
          (e.currentTarget as HTMLElement).style.removeProperty('opacity');
          draggingColumnRef.current = null;
          setDraggingColumnKey(null);
          setDragReadyColumnKey(null);
          setColumnDragOverKey(null);
        },
        onDragOver: (e: React.DragEvent<HTMLTableCellElement>) => {
          e.preventDefault();
          const drag = draggingColumnRef.current;
          if (drag && drag !== columnId) {
            setColumnDragOverKey(columnId);
          }
        },
        onDrop: () => {
          const from = draggingColumnRef.current;
          if (!from || from === columnId) return;
          reorder(from, columnId);
          draggingColumnRef.current = null;
          setDraggingColumnKey(null);
          setDragReadyColumnKey(null);
          setColumnDragOverKey(null);
        },
      } as const;
    },
    [
      armColumnDragAfterHold,
      disarmColumn,
      dragReadyColumnKey,
      draggingColumnKey,
      columnDragOverKey,
      holdingColumnKey,
      reorder,
      useBuiltInDragImage,
    ],
  );

  return { getThProps, draggingColumnKey, columnDragOverKey };
}
