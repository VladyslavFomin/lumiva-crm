/**
 * Единый выбор периода для всей CRM — дизайн «ROI по клиентам» (roi/RoiParts PeriodPicker),
 * но с точностью до дня: кнопка «📅 2 сен — 1 окт 2026 | 30 дн», поповер с пресетами слева
 * и двумя месяцами справа. Применяется только по «Применить», как в ROI.
 * from = null означает «всё время».
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import './DateRangePicker.css';

export type DateRange = { from: Date | null; to: Date | null };
export type DateRangePreset = { id: string; label: string; range: DateRange };
export type DateRangeChange = { presetId: string | null; from: Date | null; to: Date | null };

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dayKey = (d: Date) => d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
/** Число календарных дней в диапазоне включительно. */
export const rangeDays = (from: Date, to: Date) => Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY) + 1;
/** yyyy-mm-dd по локальному времени (без сдвига UTC, в отличие от toISOString). */
export const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fromIsoDate = (s: string | null | undefined): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
/** «Последние N дней» включая сегодня. */
export const lastDays = (n: number): DateRange => {
  const to = endOfDay(new Date());
  const from = startOfDay(new Date());
  from.setDate(from.getDate() - (n - 1));
  return { from, to };
};

const Ico: React.FC<{ d: React.ReactNode }> = ({ d }) => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const CAL = (
  <>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </>
);

export function formatRange(from: Date, to: Date, locale: string) {
  const dm = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }).replace('.', '');
  const dmy = (d: Date) => `${dm(d)} ${d.getFullYear()}`;
  if (sameDay(from, to)) return dmy(to);
  return from.getFullYear() === to.getFullYear() ? `${dm(from)} — ${dmy(to)}` : `${dmy(from)} — ${dmy(to)}`;
}

export const DateRangePicker: React.FC<{
  value: DateRange;
  /** Активный пресет: подсвечивается в списке; для from=null его название показывается на кнопке.
   *  Не передан — определяется сам по совпадению дат. */
  presetId?: string | null;
  presets: DateRangePreset[];
  onChange: (v: DateRangeChange) => void;
  /** false — только пресеты (бэкенд умеет лишь «последние N дней»). */
  allowCustom?: boolean;
  maxDate?: Date | null;
  minDate?: Date | null;
  className?: string;
}> = ({ value, presetId: presetIdProp, presets, onChange, allowCustom = true, maxDate, minDate, className }) => {
  const { t, i18n } = useTranslation();
  const sameRange = (a: DateRange, b: DateRange) =>
    (!a.from && !b.from) || (!!a.from && !!b.from && !!a.to && !!b.to && sameDay(a.from, b.from) && sameDay(a.to, b.to));
  const presetId = presetIdProp !== undefined ? presetIdProp : (presets.find((p) => sameRange(p.range, value))?.id ?? null);
  const locale = i18n.language || 'ru';
  const max = maxDate === null ? null : startOfDay(maxDate ?? new Date());
  const min = minDate ? startOfDay(minDate) : null;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRangeChange>({ presetId, ...value });
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [hover, setHover] = useState<Date | null>(null);
  const [view, setView] = useState(() => new Date());
  const [pos, setPos] = useState<React.CSSProperties | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const tg = e.target as Node;
      if (ref.current?.contains(tg) || popRef.current?.contains(tg)) return;
      setOpen(false);
    };
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', k);
    };
  }, [open]);

  // Поповер рендерится в body (fixed), чтобы его не обрезали модалки и контейнеры с overflow:hidden.
  // Ставим под кнопкой, прижимаем к краям окна; если снизу не помещается — открываем вверх.
  useLayoutEffect(() => {
    if (!open) return setPos(null);
    const place = () => {
      const tr = ref.current?.getBoundingClientRect();
      const pop = popRef.current;
      if (!tr || !pop) return;
      if (window.innerWidth <= 767) return setPos({});
      const w = pop.offsetWidth;
      const h = pop.offsetHeight;
      const left = Math.max(8, Math.min(tr.left, window.innerWidth - w - 8));
      const below = tr.bottom + 6;
      const top = below + h > window.innerHeight - 8 && tr.top - 6 - h >= 8 ? tr.top - 6 - h : below;
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, allowCustom]);

  const weekdays = useMemo(() => {
    // 2024-01-01 — понедельник
    return Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' }).replace('.', ''));
  }, [locale]);
  const monthTitle = (d: Date) => {
    const s = d.toLocaleDateString(locale, { month: 'long', year: 'numeric' }).replace(/\s?г\.?$/, '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const toggle = () => {
    if (!open) {
      setDraft({ presetId, ...value });
      setAnchor(null);
      setHover(null);
      const base = value.to ?? max ?? new Date();
      setView(new Date(base.getFullYear(), base.getMonth() - 1, 1));
    }
    setOpen(!open);
  };

  const disabled = (d: Date) => (max != null && d > max) || (min != null && d < min);
  const pick = (d: Date) => {
    if (!anchor) {
      setAnchor(d);
      setDraft({ presetId: null, from: startOfDay(d), to: endOfDay(d) });
    } else {
      const [a, b] = d < anchor ? [d, anchor] : [anchor, d];
      setDraft({ presetId: null, from: startOfDay(a), to: endOfDay(b) });
      setAnchor(null);
    }
  };
  const lo = anchor ? (hover && hover < anchor ? hover : anchor) : draft.from;
  const hi = anchor ? (hover && hover > anchor ? hover : anchor) : draft.from ? draft.to : null;

  const daysLbl = t('crm.dateRange.daysShort', { defaultValue: 'дн' });
  const presetLabel = (id: string | null) => presets.find((p) => p.id === id)?.label;
  const allLbl = t('crm.dateRange.allTime', { defaultValue: 'Всё время' });
  const triggerText = value.from && value.to ? formatRange(value.from, value.to, locale) : presetLabel(presetId) || allLbl;
  const n = value.from && value.to ? rangeDays(value.from, value.to) : null;
  const draftText =
    draft.from && draft.to ? `${formatRange(draft.from, draft.to, locale)} · ${rangeDays(draft.from, draft.to)} ${daysLbl}` : presetLabel(draft.presetId) || allLbl;

  const month = (offset: number) => {
    const first = new Date(view.getFullYear(), view.getMonth() + offset, 1);
    const lead = (first.getDay() + 6) % 7;
    const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells: Array<Date | null> = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1))];
    return (
      <div key={offset} className="lv-dr-month">
        <div className="mh">{monthTitle(first)}</div>
        <div className="grid wd">
          {weekdays.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="grid" onMouseLeave={() => setHover(null)}>
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const dis = disabled(d);
            const k = dayKey(d);
            const inR = !!lo && !!hi && k >= dayKey(lo) && k <= dayKey(hi);
            const st = !!lo && sameDay(d, lo);
            const en = !!hi && sameDay(d, hi);
            return (
              <button
                type="button"
                key={k}
                disabled={dis}
                onMouseEnter={() => !dis && setHover(d)}
                onClick={() => pick(d)}
                className={[inR && 'in', st && 'st', en && 'en', max && sameDay(d, max) && 'today'].filter(Boolean).join(' ')}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={['lv-dr', className].filter(Boolean).join(' ')} ref={ref}>
      <button type="button" className={['lv-dr-t', open && 'on'].filter(Boolean).join(' ')} onClick={toggle} aria-expanded={open}>
        <Ico d={CAL} />
        <span>{triggerText}</span>
        {n != null && (
          <em>
            {n} {daysLbl}
          </em>
        )}
      </button>
      {open &&
        createPortal(
        <div
          className={['lv-dr-pop', !allowCustom && 'solo'].filter(Boolean).join(' ')}
          ref={popRef}
          style={pos ?? { top: 0, left: 0, visibility: 'hidden' }}
        >
          <div className="lv-dr-pre">
            <div className="kick">{t('crm.dateRange.title', { defaultValue: 'Период' })}</div>
            {presets.map((p) => (
              <button
                type="button"
                key={p.id}
                className={draft.presetId === p.id ? 'on' : undefined}
                onClick={() => {
                  setAnchor(null);
                  if (!allowCustom) {
                    onChange({ presetId: p.id, ...p.range });
                    setOpen(false);
                    return;
                  }
                  setDraft({ presetId: p.id, ...p.range });
                  if (p.range.to) setView(new Date(p.range.to.getFullYear(), p.range.to.getMonth() - 1, 1));
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          {allowCustom && (
            <div className="lv-dr-cal">
              <div className="lv-dr-nav">
                <button type="button" className="lv-dr-ib" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} aria-label="‹">
                  <Ico d={<path d="M15 6l-6 6 6 6" />} />
                </button>
                <span>
                  {anchor
                    ? t('crm.dateRange.pickLast', { defaultValue: 'Выберите последний день' })
                    : t('crm.dateRange.pickFirst', { defaultValue: 'Выберите первый день' })}
                </span>
                <button
                  type="button"
                  className="lv-dr-ib"
                  disabled={!!max && new Date(view.getFullYear(), view.getMonth() + 2, 1) > max}
                  onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
                  aria-label="›"
                >
                  <Ico d={<path d="M9 6l6 6-6 6" />} />
                </button>
              </div>
              <div className="lv-dr-months">{[0, 1].map(month)}</div>
              <div className="lv-dr-foot">
                <span className="mono">{draftText}</span>
                <div style={{ flex: 1 }} />
                <button type="button" className="lv-dr-btn" onClick={() => setOpen(false)}>
                  {t('crm.dateRange.cancel', { defaultValue: 'Отмена' })}
                </button>
                <button
                  type="button"
                  className="lv-dr-btn pri"
                  disabled={!!anchor}
                  onClick={() => {
                    onChange(draft);
                    setOpen(false);
                  }}
                >
                  {t('crm.dateRange.apply', { defaultValue: 'Применить' })}
                </button>
              </div>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
};

export default DateRangePicker;
