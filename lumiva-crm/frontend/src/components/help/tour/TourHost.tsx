import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { HelpMediaView } from '../HelpMediaView';
import { disableAutoTours, finishTour, goToStep, useActiveTour } from './tourStore';

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 6; // отступ подсветки вокруг элемента
const GAP = 12; // расстояние от подсветки до окна
const EDGE = 16; // минимальный отступ окна от края экрана

/** Первый видимый элемент с data-tour="<target>". */
function findTarget(target: string | null): HTMLElement | null {
  if (!target) return null;
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(target)}"]`);
  for (const el of Array.from(nodes)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el;
  }
  return null;
}

function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
}

/** Куда поставить окно: под элементом → над → справа → слева; не влезает — снизу по центру. */
function placePopover(hole: Rect | null, w: number, h: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!hole) return { top: Math.max(EDGE, (vh - h) / 2), left: Math.max(EDGE, (vw - w) / 2), origin: 'center' };
  const clampX = (x: number) => Math.min(Math.max(EDGE, x), vw - w - EDGE);
  const clampY = (y: number) => Math.min(Math.max(EDGE, y), vh - h - EDGE);
  const cx = hole.left + hole.width / 2;
  const cy = hole.top + hole.height / 2;
  if (hole.top + hole.height + GAP + h <= vh - EDGE)
    return { top: hole.top + hole.height + GAP, left: clampX(cx - w / 2), origin: 'top center' };
  if (hole.top - GAP - h >= EDGE) return { top: hole.top - GAP - h, left: clampX(cx - w / 2), origin: 'bottom center' };
  if (hole.left + hole.width + GAP + w <= vw - EDGE)
    return { top: clampY(cy - h / 2), left: hole.left + hole.width + GAP, origin: 'center left' };
  if (hole.left - GAP - w >= EDGE) return { top: clampY(cy - h / 2), left: hole.left - GAP - w, origin: 'center right' };
  return { top: vh - h - EDGE, left: clampX(cx - w / 2), origin: 'bottom center' };
}

/**
 * Окно подсказки рядом с элементом + затемнение вокруг него. Один на приложение (MainLayout),
 * тур запускают кнопка «?» (PageHelpButton) и автозапуск при первом заходе на страницу.
 */
export const TourHost: React.FC = () => {
  const tour = useActiveTour();
  const { t } = useTranslation();
  const popRef = useRef<HTMLDivElement>(null);
  const [hole, setHole] = useState<Rect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; origin: string } | null>(null);

  const step = tour ? tour.steps[tour.index] : null;
  const total = tour?.steps.length || 0;
  const isLast = !!tour && tour.index === total - 1;

  // Подводим элемент в видимую область при смене шага.
  useEffect(() => {
    if (!step) return;
    const el = findTarget(step.target);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > window.innerHeight - 80) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [step]);

  // Следим за положением элемента каждый кадр: прокрутка, ресайз, догрузка данных — без лишних слушателей.
  useLayoutEffect(() => {
    if (!step) {
      setHole(null);
      setPos(null);
      return;
    }
    let raf = 0;
    let last = '';
    const tick = () => {
      const el = findTarget(step.target);
      const h = el ? rectOf(el) : null;
      const pop = popRef.current;
      const w = pop?.offsetWidth || 360;
      const ph = pop?.offsetHeight || 220;
      const p = placePopover(h, w, ph);
      const sig = JSON.stringify([h, p]);
      if (sig !== last) {
        last = sig;
        setHole(h);
        setPos(p);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [step]);

  useEffect(() => {
    if (!tour) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finishTour();
      else if (e.key === 'ArrowRight') isLast ? finishTour() : goToStep(tour.index + 1);
      else if (e.key === 'ArrowLeft') goToStep(tour.index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tour, isLast]);

  if (!tour || !step) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2147483001]" role="dialog" aria-modal="true" aria-labelledby="lv-tour-title">
      {/* Выше виджета чата поддержки (lumiva-chat.js, z-index 2147483000), иначе пузырь перекрывает окно. */}
      {/* Слой перехватывает клики: во время тура страница не реагирует, чтобы случайно ничего не изменить. */}
      <div className={`absolute inset-0 ${hole ? '' : 'lv-backdrop bg-slate-950/45'}`} />
      {hole && (
        <div
          className="lv-backdrop pointer-events-none fixed rounded-xl ring-2 ring-white/90"
          style={{
            top: 0,
            left: 0,
            width: hole.width,
            height: hole.height,
            translate: `${hole.left}px ${hole.top}px`,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.45)',
          }}
        />
      )}
      <div
        ref={popRef}
        key={`${tour.topic}:${tour.index}`}
        className="lv-pop fixed w-[min(360px,calc(100vw-32px))] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_24px_64px_rgba(15,23,42,0.28)]"
        style={{
          top: pos?.top ?? -9999,
          left: pos?.left ?? -9999,
          ['--lv-pop-origin' as string]: pos?.origin || 'center',
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1" aria-label={t('crm.tour.stepOf', { current: tour.index + 1, total })}>
            {tour.steps.map((s, i) => (
              <span
                key={s.id}
                className="block h-1.5 rounded-full transition-[width,background-color] duration-200"
                style={{
                  width: i === tour.index ? 16 : 6,
                  background: i === tour.index ? '#0f172a' : i < tour.index ? '#94a3b8' : '#e2e8f0',
                }}
              />
            ))}
          </div>
          <span className="text-[11px] font-medium tabular-nums text-slate-400">
            {tour.index + 1} / {total}
          </span>
        </div>

        <h3 id="lv-tour-title" className="text-[15px] font-semibold leading-snug text-slate-900">
          {step.title}
        </h3>
        <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-slate-600">{step.body}</p>

        {step.media && <HelpMediaView media={step.media} compact className="mt-3" />}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={finishTour}
            className="rounded-lg px-2 py-1.5 text-[12px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            {t('crm.tour.skip')}
          </button>
          <div className="flex items-center gap-2">
            {tour.index > 0 && (
              <button
                type="button"
                onClick={() => goToStep(tour.index - 1)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 active:scale-[0.97]"
              >
                {t('crm.tour.back')}
              </button>
            )}
            <button
              type="button"
              autoFocus
              onClick={() => (isLast ? finishTour() : goToStep(tour.index + 1))}
              className="rounded-xl bg-[#222222] px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-black active:scale-[0.97]"
            >
              {isLast ? t('crm.tour.done') : t('crm.tour.next')}
            </button>
          </div>
        </div>

        {tour.index === 0 && (
          <button
            type="button"
            onClick={() => {
              disableAutoTours();
              finishTour();
            }}
            className="mt-3 block text-[11px] text-slate-400 underline-offset-2 transition hover:text-slate-600 hover:underline"
          >
            {t('crm.tour.dontShow')}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
};
