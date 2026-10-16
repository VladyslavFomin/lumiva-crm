import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRepT } from './ReputationShared';

export interface RepMultiOption {
  value: string;
  label: string;
  /** Маленький значок слева (бейдж площадки, флаг). */
  icon?: React.ReactNode;
}

/**
 * Фильтр с чекбоксами: «Все …» (ничего не выбрано) или несколько значений. Внешне — как обычный select
 * раздела, попап — как стилизованный список сайта. Поиск появляется, если вариантов больше 8.
 */
export const RepMultiSelect: React.FC<{
  allLabel: string;
  options: RepMultiOption[];
  value: string[];
  onChange: (v: string[]) => void;
  /** data-атрибут для туров/тестов. */
  testId?: string;
}> = ({ allLabel, options, value, onChange, testId }) => {
  const { r } = useRepT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => new Set(value), [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const shown = q.trim() ? options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())) : options;
  const picked = options.filter((o) => selected.has(o.value));
  const label = !picked.length ? allLabel : picked.length === 1 ? picked[0].label : r('multi.selected', { first: picked[0].label, n: picked.length - 1 });
  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    // порядок — как в списке вариантов, чтобы ссылка не менялась от порядка кликов
    onChange(options.map((o) => o.value).filter((x) => next.has(x)));
  };

  return (
    <div className={`rp-ms${open ? ' open' : ''}${picked.length ? ' has' : ''}`} ref={box} data-testid={testId}>
      <button type="button" className="rp-ms-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} title={picked.map((p) => p.label).join(', ')}>
        <span className="rp-ms-label">{label}</span>
        {picked.length > 1 && <span className="rp-ms-count">{picked.length}</span>}
        <svg className="rp-ms-chev" viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="rp-ms-pop" role="listbox" aria-multiselectable="true">
          {options.length > 8 && (
            <input className="rp-ms-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={r('multi.search')} />
          )}
          <button type="button" className={`rp-ms-opt all${!picked.length ? ' on' : ''}`} onClick={() => onChange([])}>
            <span className="rp-ms-box" aria-hidden="true" />
            <span className="t">{allLabel}</span>
          </button>
          <div className="rp-ms-list">
            {shown.map((o) => (
              <button key={o.value} type="button" role="option" aria-selected={selected.has(o.value)} className={`rp-ms-opt${selected.has(o.value) ? ' on' : ''}`} onClick={() => toggle(o.value)}>
                <span className="rp-ms-box" aria-hidden="true" />
                {o.icon}
                <span className="t">{o.label}</span>
              </button>
            ))}
            {!shown.length && <div className="rp-ms-empty">{r('multi.nothing')}</div>}
          </div>
          {picked.length > 0 && (
            <div className="rp-ms-foot">
              <button type="button" onClick={() => onChange([])}>{r('multi.clear')}</button>
              <button type="button" className="done" onClick={() => setOpen(false)}>{r('multi.done')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** «a,b» из URL ↔ массив. */
export const splitParam = (v: string | null | undefined): string[] => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);
export const joinParam = (v: string[]): string | null => (v.length ? v.join(',') : null);
