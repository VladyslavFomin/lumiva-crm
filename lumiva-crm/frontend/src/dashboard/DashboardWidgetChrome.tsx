import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WidgetSize } from './dashboardLayout';
import { sizeToColSpan } from './dashboardLayout';
import { useBlockLive, type BlockLiveStore } from '../components/analytics/useBlockGridInteractions';

export const DashboardWidgetChrome: React.FC<{
  title: string;
  sub?: string;
  size: WidgetSize;
  /** Колонок в сетке 12 (4–12), плавная ширина */
  colSpan?: number;
  /** Высота карточки (px), как в аналитике лидов */
  heightPx: number;
  /** Режим настройки блоков — включает ручку перетаскивания и хэндлы ресайза */
  edit?: boolean;
  /** Атрибут data-block-id — по нему движок перетаскивания находит блоки в сетке */
  blockId?: string;
  /** Хранилище живых размеров: карточка сама подписывается и перерисовывается при растягивании,
   * а страница целиком — нет (иначе каждый кадр перерисовывал бы все графики главной) */
  liveStore?: BlockLiveStore;
  onBeginResize?: (axis: 'x' | 'y' | 'both', e: React.PointerEvent<HTMLElement>) => void;
  resizeActive?: boolean;
  /** Нажатие на шапку блока в режиме настройки — начало перетаскивания */
  onBeginDrag?: (e: React.PointerEvent<HTMLElement>) => void;
  /** Блок сейчас тащат: на его месте рисуется пунктирная заглушка */
  dragging?: boolean;
  onEdit?: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}> = ({
  title,
  sub,
  size,
  colSpan: colSpanProp,
  heightPx: heightPxProp,
  edit,
  blockId,
  liveStore,
  onBeginResize,
  resizeActive: resizeActiveProp,
  onBeginDrag,
  dragging,
  onEdit,
  children,
  actions,
}) => {
  const { t } = useTranslation();
  const liveNow = useBlockLive(liveStore, blockId);
  const resizeActive = resizeActiveProp || !!liveNow;
  const heightPx = liveNow ? liveNow.height : heightPxProp;
  const colSpan = liveNow ? liveNow.span : colSpanProp ?? sizeToColSpan(size);
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
      data-block-id={blockId}
      className={`group dh-card relative min-w-0 overflow-visible ${resizeActive ? '' : 'transition-[ring,border-color] duration-300'} ${edit ? 'dh-edit' : ''} ${resizeActive ? 'dh-resizing' : ''}`}
      style={{
        gridColumn: `span ${span} / span ${span}`,
      }}
    >
      {/* Внешняя оболочка без overflow:hidden — иначе обрезаются хэндлы resize у края */}
      <div
        className={`relative flex flex-col rounded-xl border bg-white ${
          dragging
            ? 'border-2 border-dashed border-blue-400 bg-blue-50/60 [&>*]:opacity-0'
            : 'border-neutral-200 transition-[border-color,background-color,box-shadow] duration-300 hover:border-neutral-300'
        }`}
        style={{ height: heightPx, minHeight: heightPx }}
      >
        <div className="relative z-10 flex flex-col min-h-0 h-full overflow-hidden rounded-xl">
          <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-gradient-to-br from-white/0 via-neutral-50/30 to-neutral-100/25" />

          <div className="relative z-10 p-3.5 flex flex-col min-h-0 h-full">
            <div
              className={`flex items-start justify-between gap-2 mb-2.5 shrink-0 ${edit && onBeginDrag ? 'cursor-grab touch-none active:cursor-grabbing' : ''}`}
              onPointerDown={(e) => {
                if (!edit || !onBeginDrag) return;
                if ((e.target as HTMLElement).closest('a,button,input,textarea,select')) return;
                onBeginDrag(e);
              }}
            >
              <div className="min-w-0 flex-1 flex items-start gap-1.5">
                {edit && (
                  <span
                    className="dh-grip mt-0.5"
                    title={t('crm.dashboard.widgets.drag')}
                    aria-hidden
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                      {[2, 6, 10].map((y) => [3, 9].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" />))}
                    </svg>
                  </span>
                )}
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

        {onBeginResize && edit && (
          <>
            {xlWide && (
              <div
                onPointerDown={(e) => onBeginResize('x', e)}
                className="dh-rz e"
                style={{ touchAction: 'none' }}
                title={t('crm.projects.analytics.resize.width')}
              />
            )}
            <div
              onPointerDown={(e) => onBeginResize('y', e)}
              className="dh-rz s"
              style={{ touchAction: 'none' }}
              title={t('crm.projects.analytics.resize.height')}
            />
            {xlWide && (
              <div
                onPointerDown={(e) => onBeginResize('both', e)}
                className="dh-rz se"
                style={{ touchAction: 'none' }}
                title={t('crm.projects.analytics.resize.both')}
              />
            )}
            {resizeActive && (
              <div className="dh-size">
                {t('crm.dashboard.widgets.sizeBadge', { span: colSpan, height: Math.round(heightPx) })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
