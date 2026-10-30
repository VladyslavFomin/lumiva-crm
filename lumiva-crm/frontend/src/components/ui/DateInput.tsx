/**
 * Единое поле одной даты — замена нативного <input type="date"> (у него системный календарь,
 * разный в каждом браузере). Поповер того же вида, что DateRangePicker: рендер в body, месяц
 * с переходом к месяцам/годам, «Сегодня» / «Очистить».
 * Значение — строка yyyy-mm-dd ('' = пусто), onChange получает такую же строку.
 * Само поле — обычный <input>, поэтому наследует стили контейнера (.htl-f input, .bk-modal-body input…).
 * Дату можно и напечатать: 02.11.2026, 2.11.26, 2026-11-02.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { fromIsoDate, toIsoDate } from './DateRangePicker';
import './DateRangePicker.css';
import './DateInput.css';

type View = 'days' | 'months' | 'years';

const pad = (n: number) => String(n).padStart(2, '0');
const display = (iso: string) => {
  const d = fromIsoDate(iso);
  return d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : '';
};
/** Разбор напечатанной даты: dd.mm.yyyy (любой разделитель), dd.mm.yy, yyyy-mm-dd. */
const parseTyped = (s: string): string | null => {
  const v = s.trim();
  let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(v);
  let y: number, mo: number, d: number;
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else {
    m = /^(\d{1,2})[-./\s](\d{1,2})[-./\s](\d{2}|\d{4})$/.exec(v);
    if (!m) return null;
    [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (y < 100) y += y > 50 ? 1900 : 2000;
  }
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? toIsoDate(dt) : null;
};

const Arrow: React.FC<{ dir: 'l' | 'r' }> = ({ dir }) => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === 'l' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
  </svg>
);

export const DateInput: React.FC<{
  value: string | null | undefined;
  onChange: (iso: string) => void;
  min?: string | null;
  max?: string | null;
  /** false — пустое значение недопустимо, кнопки «Очистить» нет (фильтры дня/периода). */
  clearable?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Класс самого <input> — чтобы поле выглядело как соседние (htl-date, htl-cell-in, rp-input…). */
  className?: string;
  style?: React.CSSProperties;
  /** Встроить в строку (тулбар) вместо поля на всю ширину. */
  inline?: boolean;
  id?: string;
  'aria-label'?: string;
}> = ({ value, onChange, min, max, clearable = true, disabled, placeholder, className, style, inline, id, ...rest }) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'ru';
  const iso = value || '';
  const [text, setText] = useState(display(iso));
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('days');
  const [cursor, setCursor] = useState(() => fromIsoDate(iso) || new Date());
  const [pos, setPos] = useState<React.CSSProperties | null>(null);
  const ref = useRef<HTMLSpanElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const minD = fromIsoDate(min);
  const maxD = fromIsoDate(max);

  useEffect(() => setText(display(iso)), [iso]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const tg = e.target as Node;
      if (ref.current?.contains(tg) || popRef.current?.contains(tg)) return;
      setOpen(false);
    };
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k, true);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', k, true);
    };
  }, [open]);

  // Как в DateRangePicker: fixed в body, под полем, у края окна — сдвиг, снизу не влезает — вверх.
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
      const top = below + h > window.innerHeight - 8 && tr.top - 6 - h >= 8 ? tr.top - 6 - h : Math.max(8, Math.min(below, window.innerHeight - h - 8));
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, view]);

  const weekdays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' }).replace('.', '')),
    [locale],
  );
  const monthNames = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const s = new Date(2024, i, 1).toLocaleDateString(locale, { month: 'short' }).replace('.', '');
        return s.charAt(0).toUpperCase() + s.slice(1);
      }),
    [locale],
  );
  const monthTitle = (d: Date) => {
    const s = d.toLocaleDateString(locale, { month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const outOfRange = (d: Date) => (!!minD && d < minD) || (!!maxD && d > maxD);
  const openPop = () => {
    if (disabled) return;
    setCursor(fromIsoDate(iso) || (minD && minD > new Date() ? minD : new Date()));
    setView('days');
    setOpen(true);
  };
  const commit = (next: string) => {
    if (next !== iso) onChange(next);
    setText(display(next));
  };
  const pick = (d: Date) => {
    commit(toIsoDate(d));
    setOpen(false);
    inputRef.current?.focus();
  };
  const onBlurText = () => {
    if (text === display(iso)) return;
    if (!text.trim()) {
      if (clearable) commit('');
      else setText(display(iso));
      return;
    }
    const parsed = parseTyped(text);
    const pd = parsed ? fromIsoDate(parsed) : null;
    if (parsed && pd && !outOfRange(pd)) commit(parsed);
    else setText(display(iso));
  };

  const sel = fromIsoDate(iso);
  const today = new Date();
  const sameDay = (a: Date | null, b: Date) => !!a && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const shift = (months: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + months, 1));
  const decade = Math.floor(cursor.getFullYear() / 12) * 12;

  const header =
    view === 'days' ? (
      <button type="button" className="lv-di-title" onClick={() => setView('months')}>
        {monthTitle(cursor)} <b>{cursor.getFullYear()}</b>
      </button>
    ) : view === 'months' ? (
      <button type="button" className="lv-di-title" onClick={() => setView('years')}>
        <b>{cursor.getFullYear()}</b>
      </button>
    ) : (
      <span className="lv-di-title static">
        <b>
          {decade} — {decade + 11}
        </b>
      </span>
    );

  const body = () => {
    if (view === 'months')
      return (
        <div className="lv-di-grid3">
          {monthNames.map((m, i) => (
            <button
              type="button"
              key={m}
              className={[sel && sel.getFullYear() === cursor.getFullYear() && sel.getMonth() === i && 'on', today.getFullYear() === cursor.getFullYear() && today.getMonth() === i && 'today'].filter(Boolean).join(' ')}
              onClick={() => {
                setCursor(new Date(cursor.getFullYear(), i, 1));
                setView('days');
              }}
            >
              {m}
            </button>
          ))}
        </div>
      );
    if (view === 'years')
      return (
        <div className="lv-di-grid3">
          {Array.from({ length: 12 }, (_, i) => decade + i).map((y) => (
            <button
              type="button"
              key={y}
              className={[sel?.getFullYear() === y && 'on', today.getFullYear() === y && 'today'].filter(Boolean).join(' ')}
              onClick={() => {
                setCursor(new Date(y, cursor.getMonth(), 1));
                setView('months');
              }}
            >
              {y}
            </button>
          ))}
        </div>
      );
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7;
    const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells: Array<Date | null> = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1))];
    return (
      <div className="lv-dr-month">
        <div className="grid wd">
          {weekdays.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="grid">
          {cells.map((d, i) =>
            d ? (
              <button
                type="button"
                key={i}
                disabled={outOfRange(d)}
                onClick={() => pick(d)}
                className={[sameDay(sel, d) && 'st en', sameDay(today, d) && 'today'].filter(Boolean).join(' ')}
              >
                {d.getDate()}
              </button>
            ) : (
              <span key={i} />
            ),
          )}
        </div>
      </div>
    );
  };

  const todayDisabled = outOfRange(new Date(today.getFullYear(), today.getMonth(), today.getDate()));

  return (
    <span className={['lv-di', inline ? 'inline' : '', disabled ? 'dis' : ''].filter(Boolean).join(' ')} ref={ref}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={className}
        style={style}
        disabled={disabled}
        value={text}
        placeholder={placeholder ?? t('crm.dateField.placeholder', { defaultValue: 'дд.мм.гггг' })}
        aria-label={rest['aria-label']}
        aria-haspopup="dialog"
        aria-expanded={open}
        onChange={(e) => setText(e.target.value)}
        onClick={() => !open && openPop()}
        onBlur={onBlurText}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onBlurText();
            setOpen(false);
          } else if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            openPop();
          }
        }}
      />
      <button type="button" className="lv-di-ico" tabIndex={-1} disabled={disabled} onClick={() => (open ? setOpen(false) : openPop())} aria-label={t('crm.dateField.open', { defaultValue: 'Открыть календарь' })}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div className="lv-dr-pop lv-di-pop" ref={popRef} role="dialog" style={pos ?? { top: 0, left: 0, visibility: 'hidden' }} onMouseDown={(e) => e.preventDefault()}>
            <div className="lv-dr-cal">
              <div className="lv-dr-nav">
                <button type="button" className="lv-dr-ib" onClick={() => (view === 'days' ? shift(-1) : view === 'months' ? shift(-12) : shift(-144))} aria-label={t('crm.dateField.prev', { defaultValue: 'Назад' })}>
                  <Arrow dir="l" />
                </button>
                {header}
                <button type="button" className="lv-dr-ib" onClick={() => (view === 'days' ? shift(1) : view === 'months' ? shift(12) : shift(144))} aria-label={t('crm.dateField.next', { defaultValue: 'Вперёд' })}>
                  <Arrow dir="r" />
                </button>
              </div>
              {body()}
              <div className="lv-dr-foot">
                {clearable && (
                  <button type="button" className="lv-dr-btn" disabled={!iso} onClick={() => { commit(''); setOpen(false); }}>
                    {t('crm.dateField.clear', { defaultValue: 'Очистить' })}
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button type="button" className="lv-dr-btn pri" disabled={todayDisabled} onClick={() => pick(new Date())}>
                  {t('crm.dateField.today', { defaultValue: 'Сегодня' })}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
};

export default DateInput;
