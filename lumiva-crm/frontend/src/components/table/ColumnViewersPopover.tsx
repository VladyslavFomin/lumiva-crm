import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { StaffUser } from '../../api/staff';
import './ColumnAccess.css';

export const LockIcon: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
);

const CrownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" />
  </svg>
);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

type Props = {
  /** Элемент, от которого открыт поповер (кнопка замка / пункт меню). */
  anchor: { top: number; left: number; bottom: number; right: number };
  columnLabel: string;
  staff: StaffUser[];
  selected: string[];
  saving?: boolean;
  onChange: (staffUserIds: string[]) => void;
  onClose: () => void;
};

/**
 * «Кто может просматривать этот столбец» — общий для рабочих таблиц, Лидов и Проектов.
 * Пустой выбор = колонку видят все. Владелец компании видит всегда (строка с короной).
 * Сохраняет сразу на каждый клик (onChange), закрывается кликом мимо / Esc.
 */
export const ColumnViewersPopover: React.FC<Props> = ({ anchor, columnLabel, staff, selected, saving, onChange, onClose }) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement | null>(null);
  const [q, setQ] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: anchor.bottom + 6, left: anchor.left });

  useLayoutEffect(() => {
    const el = ref.current;
    const w = el?.offsetWidth ?? 320;
    const h = el?.offsetHeight ?? 360;
    let left = Math.min(anchor.left, window.innerWidth - w - 8);
    left = Math.max(8, left);
    let top = anchor.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, anchor.top - h - 6);
    setPos({ top, left });
  }, [anchor.bottom, anchor.left, anchor.top]);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // mousedown того же клика, что открыл поповер, не должен его сразу закрыть
    const id = window.setTimeout(() => window.addEventListener('mousedown', down), 0);
    window.addEventListener('keydown', key);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('mousedown', down);
      window.removeEventListener('keydown', key);
    };
  }, [onClose]);

  const active = useMemo(() => staff.filter((s) => s.isActive !== false), [staff]);
  const owners = useMemo(() => active.filter((s) => s.role === 'owner'), [active]);
  const others = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return active
      .filter((s) => s.role !== 'owner')
      .filter((s) => !needle || `${s.fullName} ${s.email}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const sa = selected.includes(a.id) ? 0 : 1;
        const sb = selected.includes(b.id) ? 0 : 1;
        return sa - sb || (a.fullName || a.email).localeCompare(b.fullName || b.email);
      });
  }, [active, q, selected]);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  const restricted = selected.length > 0;

  return createPortal(
    <div
      ref={ref}
      className="cva-pop lv-pop"
      style={{ top: pos.top, left: pos.left, ['--lv-pop-origin' as any]: 'top left' }}
      role="dialog"
      aria-label={t('crm.columnAccess.title')}
      data-column-menu
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="cva-pop-head">
        <h3 className="cva-pop-title">{t('crm.columnAccess.title')}</h3>
        <div className="cva-pop-sub">
          «{columnLabel}» ·{' '}
          {restricted ? t('crm.columnAccess.restrictedCount', { count: selected.length }) : t('crm.columnAccess.everyone')}
        </div>
      </div>
      <input
        className="cva-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('crm.columnAccess.searchPlaceholder')}
        autoFocus
      />
      <div className="cva-list">
        <div className="cva-row locked" title={t('crm.columnAccess.ownerAlways')}>
          <span className="cva-ava">
            <CrownIcon />
          </span>
          <span className="cva-name">
            <b>{owners.length ? owners.map((o) => o.fullName || o.email).join(', ') : t('crm.columnAccess.ownerRow')}</b>
            <small>{t('crm.columnAccess.ownerAlways')}</small>
          </span>
          <span className="cva-crown">
            <CrownIcon />
          </span>
        </div>
        {others.map((s) => {
          const on = selected.includes(s.id);
          const name = s.fullName || s.email;
          return (
            <button key={s.id} type="button" className="cva-row" onClick={() => toggle(s.id)} disabled={saving}>
              <span className="cva-ava">{s.avatarUrl ? <img src={s.avatarUrl} alt="" /> : initials(name)}</span>
              <span className="cva-name">
                <b>{name}</b>
                {s.fullName && s.email ? <small>{s.email}</small> : null}
              </span>
              <input type="checkbox" checked={on} readOnly tabIndex={-1} />
            </button>
          );
        })}
        {!others.length && <div className="cva-empty">{t('crm.columnAccess.noStaff')}</div>}
      </div>
      <div className="cva-foot">
        <span>{restricted ? t('crm.columnAccess.hintRestricted') : t('crm.columnAccess.hintEveryone')}</span>
        {restricted && (
          <button type="button" className="btn-ghost" onClick={() => onChange([])} disabled={saving}>
            {t('crm.columnAccess.reset')}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
};
