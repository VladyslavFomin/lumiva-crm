import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WidgetSize } from './dashboardLayout';
import { sizeToColSpan } from './dashboardLayout';

/** Премиальная подсветка места вставки при drag-and-drop */
function DropInsertGlow({ position }: { position: 'before' | 'after' }) {
  const edge = position === 'before' ? '-top-4' : '-bottom-4';
  return (
    <div
      className={`absolute left-2 right-2 z-[60] pointer-events-none ${edge} flex flex-col items-stretch`}
      aria-hidden
    >
      <div className="relative mx-1 h-[10px] flex items-center justify-center">
        {/* Мягкое свечение */}
        <div className="absolute inset-x-2 -inset-y-1 rounded-full bg-gradient-to-r from-sky-400/0 via-sky-400/30 to-sky-400/0 blur-xl opacity-80" />
        {/* Внешняя линия */}
        <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-neutral-900/12 to-transparent" />
        {/* Акцентная полоса */}
        <div className="relative h-[2px] w-full rounded-full bg-gradient-to-r from-transparent via-lumiva-accent/80 to-transparent ring-1 ring-sky-400/25" />
        {/* Блик */}
        <div className="absolute inset-x-6 top-1/2 h-px -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-white/70 to-transparent" />
      </div>
    </div>
  );
}

export const DashboardWidgetChrome: React.FC<{
  title: string;
  sub?: string;
  size: WidgetSize;
  /** Колонок в сетке 12 (4–12), плавная ширина */
  colSpan?: number;
  /** Высота карточки (px), как в аналитике лидов */
  heightPx: number;
  onBeginResize?: (axis: 'x' | 'y' | 'both', e: React.MouseEvent) => void;
  resizeActive?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  dragOver?: boolean;
  /** Высокая линия вставки перед блоком */
  dropBefore?: boolean;
  /** Линия вставки после блока */
  dropAfter?: boolean;
  dragging?: boolean;
  onEdit?: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}> = ({
  title,
  sub,
  size,
  colSpan: colSpanProp,
  heightPx,
  onBeginResize,
  resizeActive,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  dragOver,
  dropBefore,
  dropAfter,
  dragging,
  onEdit,
  children,
  actions,
}) => {
  const { t } = useTranslation();
  const colSpan = colSpanProp ?? sizeToColSpan(size);
  const [xlWide, setXlWide] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1280px)').matches : true,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const on = () => setXlWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const span = xlWide ? colSpan : 12;

  return (
    <div
      className={`group relative min-w-0 overflow-visible transition-[ring,border-color] duration-300 ${
        dragOver
          ? 'z-10 rounded-[18px] ring-2 ring-sky-400/40 ring-offset-2 ring-offset-transparent'
          : ''
      } ${dragging ? 'opacity-60' : ''}`}
      style={{
        gridColumn: `span ${span} / span ${span}`,
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {dropBefore && <DropInsertGlow position="before" />}
      {/* Внешняя оболочка без overflow:hidden — иначе обрезаются хэндлы resize у края */}
      <div
        className={`relative flex flex-col rounded-[18px] border border-neutral-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.05)] transition-[border-color,background-color,box-shadow] duration-300 hover:border-neutral-300 ${
          resizeActive ? '' : 'transition-[height,min-height] duration-150 ease-out'
        }`}
        style={{ height: heightPx, minHeight: heightPx }}
        draggable
        onDragStart={(e) => {
          const el = e.target as HTMLElement;
          if (el.closest('a,button,input,textarea,select')) {
            e.preventDefault();
            return;
          }
          onDragStart?.(e);
        }}
        onDragEnd={onDragEnd}
      >
        <div className="relative z-10 flex flex-col min-h-0 h-full overflow-hidden rounded-[18px]">
          <div className="pointer-events-none absolute inset-0 rounded-[18px] opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-gradient-to-br from-white/0 via-neutral-50/30 to-neutral-100/25" />

          <div className="relative z-10 p-4 md:p-5 flex flex-col min-h-0 h-full">
            <div className="flex items-start justify-between gap-2 mb-3 shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-['Inter_Tight'] text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[#222] truncate">
                    {title}
                  </h2>
                  {onEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                      }}
                      draggable={false}
                      title={t('crm.dashboard.widgets.editBlock')}
                      className="shrink-0 opacity-0 cursor-pointer group-hover:opacity-100 transition-opacity rounded-md p-1 text-neutral-400 hover:text-[#222] hover:bg-neutral-100"
                      aria-label={t('crm.dashboard.widgets.editBlock')}
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                  )}
                </div>
                {sub && (
                  <div className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">
                    {sub}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                {actions}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable]">
              {children}
            </div>
          </div>
        </div>

        {onBeginResize && (
          <>
            {resizeActive && (
              <div className="pointer-events-none absolute inset-0 rounded-[18px] border border-lumiva-accent/30 z-30" />
            )}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                onBeginResize('y', e);
              }}
              className="absolute -top-1.5 left-3 right-3 h-3 cursor-ns-resize z-50 hover:bg-sky-500/10 rounded-full"
              title={t('crm.projects.analytics.resize.height')}
            />
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                onBeginResize('y', e);
              }}
              className="absolute -bottom-1.5 left-3 right-3 h-3 cursor-ns-resize z-50 hover:bg-sky-500/10 rounded-full"
              title={t('crm.projects.analytics.resize.height')}
            />
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                onBeginResize('x', e);
              }}
              className="absolute -left-1.5 top-3 bottom-3 w-3 cursor-ew-resize z-50 hover:bg-sky-500/10 rounded-full"
              title={t('crm.projects.analytics.resize.width')}
            />
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                onBeginResize('x', e);
              }}
              className="absolute -right-1.5 top-3 bottom-3 w-3 cursor-ew-resize z-50 hover:bg-sky-500/10 rounded-full"
              title={t('crm.projects.analytics.resize.width')}
            />
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                onBeginResize('both', e);
              }}
              className="absolute -top-1 -left-1 h-4 w-4 cursor-nwse-resize z-50 rounded-sm hover:bg-sky-500/20"
              title={t('crm.projects.analytics.resize.both')}
            />
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                onBeginResize('both', e);
              }}
              className="absolute -top-1 -right-1 h-4 w-4 cursor-nesw-resize z-50 rounded-sm hover:bg-sky-500/20"
              title={t('crm.projects.analytics.resize.both')}
            />
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                onBeginResize('both', e);
              }}
              className="absolute -bottom-1 -left-1 h-4 w-4 cursor-nesw-resize z-50 rounded-sm hover:bg-sky-500/20"
              title={t('crm.projects.analytics.resize.both')}
            />
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                onBeginResize('both', e);
              }}
              className="absolute -bottom-1 -right-1 h-4 w-4 cursor-nwse-resize z-50 rounded-sm hover:bg-sky-500/20"
              title={t('crm.projects.analytics.resize.both')}
            />
          </>
        )}
      </div>
      {dropAfter && <DropInsertGlow position="after" />}
    </div>
  );
};
