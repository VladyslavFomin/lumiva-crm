// src/components/DateFieldPicker.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import './DateFieldPicker.css';

export type DateFieldValue = string | { start: string; end: string | null } | null;

type Props = {
  type: 'date' | 'datetime' | 'daterange';
  value: DateFieldValue;
  onChange: (value: DateFieldValue) => void;
  locale?: string;
  placeholder?: string;
  /** 'field' — обычное поле формы; 'pill' — компактный цветной бейдж (для ячеек таблицы). */
  variant?: 'field' | 'pill';
  disabled?: boolean;
};

const toIsoDateOnly = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const isInRange = (day: Date, start: Date | null, end: Date | null) => {
  if (!start || !end) return false;
  const t = day.getTime();
  const lo = Math.min(start.getTime(), end.getTime());
  const hi = Math.max(start.getTime(), end.getTime());
  return t > lo && t < hi;
};

const buildWeeks = (viewDate: Date) => {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + w * 7 + d);
      week.push(day);
    }
    weeks.push(week);
  }
  return weeks;
};

const pluralizeDays = (n: number) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'дня';
  return 'дней';
};

export const DateFieldPicker: React.FC<Props> = ({
  type,
  value,
  onChange,
  locale = 'ru-RU',
  placeholder,
  variant = 'field',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [selected, setSelected] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [timeDraft, setTimeDraft] = useState('12:00');
  const rootRef = useRef<HTMLDivElement | null>(null);

  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const monday = new Date(2024, 0, 1);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return fmt.format(d).replace(/\.$/, '');
    });
  }, [locale]);

  const monthLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: 'long' });
    return Array.from({ length: 12 }, (_, i) => {
      const label = fmt.format(new Date(2024, i, 1));
      return label.charAt(0).toUpperCase() + label.slice(1);
    });
  }, [locale]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [open]);

  const openPicker = () => {
    let sel: Date | null = null;
    let end: Date | null = null;
    let time = '12:00';
    if (type === 'daterange') {
      const rv = value as { start: string; end: string | null } | null;
      if (rv?.start) {
        const d = new Date(`${rv.start}T00:00:00`);
        if (!Number.isNaN(d.getTime())) sel = d;
      }
      if (rv?.end) {
        const d = new Date(`${rv.end}T00:00:00`);
        if (!Number.isNaN(d.getTime())) end = d;
      }
    } else if (value) {
      const d = type === 'datetime' ? new Date(value as string) : new Date(`${value}T00:00:00`);
      if (!Number.isNaN(d.getTime())) {
        sel = d;
        time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
    }
    setViewDate(sel || new Date());
    setSelected(sel);
    setRangeEnd(end);
    setTimeDraft(time);
    setOpen(true);
  };

  const commitSingle = (day: Date | null, timeOverride?: string) => {
    if (!day) { onChange(null); return; }
    onChange(type === 'datetime' ? `${toIsoDateOnly(day)}T${timeOverride ?? timeDraft}` : toIsoDateOnly(day));
  };

  const commitRange = (start: Date | null, end: Date | null) => {
    onChange(start ? { start: toIsoDateOnly(start), end: end ? toIsoDateOnly(end) : null } : null);
  };

  const pickDay = (day: Date) => {
    if (type === 'daterange') {
      if (!selected || rangeEnd) {
        setSelected(day);
        setRangeEnd(null);
      } else if (day.getTime() < selected.getTime()) {
        setRangeEnd(selected);
        setSelected(day);
      } else {
        setRangeEnd(day);
      }
      return;
    }
    setSelected(day);
    if (type !== 'datetime') {
      commitSingle(day);
      setOpen(false);
    }
  };

  const displayDate = (v: any) => {
    if (!v) return null;
    const d = type === 'datetime' ? new Date(v) : new Date(`${v}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const datePart = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
    if (type !== 'datetime') return datePart;
    const timePart = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d);
    return `${datePart}, ${timePart}`;
  };

  const rangeValue = type === 'daterange' ? (value as { start: string; end: string | null } | null) : null;
  const display = useMemo(() => {
    if (type !== 'daterange') return displayDate(value);
    const start = rangeValue?.start ? new Date(`${rangeValue.start}T00:00:00`) : null;
    const end = rangeValue?.end ? new Date(`${rangeValue.end}T00:00:00`) : null;
    const fmtDay = (d: Date) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(d);
    const fmtFull = (d: Date) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
    if (start && end) {
      return start.getFullYear() === end.getFullYear() ? `${fmtDay(start)} – ${fmtFull(end)}` : `${fmtFull(start)} – ${fmtFull(end)}`;
    }
    if (start) return `с ${fmtFull(start)}`;
    if (end) return `по ${fmtFull(end)}`;
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, value, locale]);

  const daysHint = useMemo(() => {
    if (type !== 'daterange' || !rangeValue?.start || !rangeValue?.end) return null;
    const start = new Date(`${rangeValue.start}T00:00:00`);
    const end = new Date(`${rangeValue.end}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const days = Math.round(Math.abs(end.getTime() - start.getTime()) / 86400000) + 1;
    return `${days} ${pluralizeDays(days)}`;
  }, [type, rangeValue]);

  const weeks = buildWeeks(viewDate);
  const today = new Date();
  const currentMonth = viewDate.getMonth();

  return (
    <div className="dfp-root" ref={rootRef}>
      <button
        type="button"
        className={variant === 'pill' ? 'dfp-trigger-pill' : 'dfp-trigger-field'}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, opacity: 0.6 }}>
          <rect x="2.5" y="3.5" width="11" height="10" rx="1.2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
        </svg>
        <span className={display ? 'dfp-trigger-text' : 'dfp-trigger-text dfp-placeholder'}>
          {display || placeholder || '—'}
        </span>
        {daysHint && variant === 'pill' && <span className="dfp-trigger-text dfp-days-hint">{daysHint}</span>}
      </button>
      {open && (
        <div className="dfp-popover" onClick={(e) => e.stopPropagation()}>
          <div className="dfp-nav">
            <select
              className="dfp-select"
              value={currentMonth}
              onChange={(e) => {
                const next = new Date(viewDate);
                next.setDate(1);
                next.setMonth(Number(e.target.value));
                setViewDate(next);
              }}
            >
              {monthLabels.map((label, idx) => (
                <option key={label} value={idx}>{label}</option>
              ))}
            </select>
            <select
              className="dfp-select"
              value={viewDate.getFullYear()}
              onChange={(e) => {
                const next = new Date(viewDate);
                next.setDate(1);
                next.setFullYear(Number(e.target.value));
                setViewDate(next);
              }}
            >
              {Array.from({ length: 11 }, (_, i) => today.getFullYear() - 5 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <div className="dfp-arrows">
              <button
                type="button"
                className="dfp-arrow"
                onClick={() => { const next = new Date(viewDate); next.setDate(1); next.setMonth(next.getMonth() - 1); setViewDate(next); }}
                aria-label="Предыдущий месяц"
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 3.5L5 8l5 4.5" /></svg>
              </button>
              <button
                type="button"
                className="dfp-arrow"
                onClick={() => { const next = new Date(viewDate); next.setDate(1); next.setMonth(next.getMonth() + 1); setViewDate(next); }}
                aria-label="Следующий месяц"
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 3.5L11 8l-5 4.5" /></svg>
              </button>
            </div>
          </div>
          {type === 'daterange' && (
            <div className="dfp-range-hint">
              <span className={selected && !rangeEnd ? 'active' : ''}>с {selected ? displayDate(toIsoDateOnly(selected)) : '—'}</span>
              <span className={selected && !rangeEnd ? '' : 'active'}>по {rangeEnd ? displayDate(toIsoDateOnly(rangeEnd)) : '—'}</span>
            </div>
          )}
          <div className="dfp-weekdays">
            {weekdayLabels.map((label) => <span key={label}>{label}</span>)}
          </div>
          <div className="dfp-grid">
            {weeks.flat().map((day, idx) => {
              const isOtherMonth = day.getMonth() !== currentMonth;
              const isToday = isSameDay(day, today);
              const isSelected = selected ? isSameDay(day, selected) : false;
              const isRangeEnd = type === 'daterange' && rangeEnd ? isSameDay(day, rangeEnd) : false;
              const isBetween = type === 'daterange' && isInRange(day, selected, rangeEnd);
              return (
                <button
                  key={idx}
                  type="button"
                  className={[
                    'dfp-day',
                    isOtherMonth ? 'other-month' : '',
                    isToday ? 'today' : '',
                    isSelected || isRangeEnd ? 'selected' : '',
                    isBetween ? 'in-range' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => pickDay(day)}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          {type === 'datetime' && (
            <div className="dfp-time">
              <span>Время</span>
              <input type="time" value={timeDraft} onChange={(e) => setTimeDraft(e.target.value)} />
            </div>
          )}
          <div className="dfp-foot">
            <button
              type="button"
              className="dfp-link"
              onClick={() => {
                setSelected(null);
                setRangeEnd(null);
                if (type === 'daterange') commitRange(null, null);
                else commitSingle(null);
                setOpen(false);
              }}
            >
              Очистить
            </button>
            <button
              type="button"
              className="dfp-link"
              onClick={() => {
                const now = new Date();
                setViewDate(now);
                if (type === 'date') {
                  setSelected(now);
                  commitSingle(now);
                  setOpen(false);
                } else if (type === 'datetime') {
                  setSelected(now);
                }
              }}
            >
              Сегодня
            </button>
            {(type === 'datetime' || type === 'daterange') && (
              <button
                type="button"
                className="dfp-done"
                onClick={() => {
                  if (type === 'daterange') commitRange(selected, rangeEnd);
                  else commitSingle(selected);
                  setOpen(false);
                }}
              >
                Готово
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
