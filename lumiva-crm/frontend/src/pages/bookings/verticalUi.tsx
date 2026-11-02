import React from 'react';
import { useTranslation } from 'react-i18next';
import { Ic, BK_ICON } from './BookingIcons';

export function useDateLocale(): string {
  const { i18n } = useTranslation();
  return i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
}

export function fmtMoney(v: string | number | null | undefined, currency: string | null | undefined, locale: string): string {
  const n = Number(v || 0);
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: (currency || 'RUB').toUpperCase(), maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  } catch {
    return `${n.toLocaleString(locale)} ${currency || ''}`.trim();
  }
}

export const fmtTime = (iso: string | Date, locale: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
export const fmtDate = (iso: string | Date, locale: string, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }) =>
  new Date(iso).toLocaleDateString(locale, opts);

/** YYYY-MM-DD в локальном времени браузера. */
export const ymdLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const startOfWeek = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = (x.getDay() + 6) % 7; // пн = 0
  x.setDate(x.getDate() - wd);
  return x;
};

export const BkModal: React.FC<{ open: boolean; title: React.ReactNode; onClose: () => void; wide?: boolean; footer?: React.ReactNode; children: React.ReactNode }> = ({
  open,
  title,
  onClose,
  wide,
  footer,
  children,
}) => {
  if (!open) return null;
  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className={`bk-modal${wide ? ' wide' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <h3>{title}</h3>
          <button className="bk-x" onClick={onClose} aria-label="close"><Ic d={BK_ICON.x} size={15} /></button>
        </div>
        {children}
        {footer && <div className="bk-modal-foot">{footer}</div>}
      </div>
    </div>
  );
};

export const BkDrawer: React.FC<{ open: boolean; kicker?: React.ReactNode; title: React.ReactNode; onClose: () => void; footer?: React.ReactNode; width?: number; children: React.ReactNode }> = ({
  open,
  kicker,
  title,
  onClose,
  footer,
  width,
  children,
}) => {
  if (!open) return null;
  return (
    <div className="px-scope">
      <div className="bk-drawer-back" onClick={onClose} />
      <aside className="bk-drawer" style={width ? { width: `min(${width}px, 100vw)` } : undefined}>
        <div className="bk-drawer-head">
          <div style={{ minWidth: 0 }}>
            {kicker && <div className="k">{kicker}</div>}
            <h3>{title}</h3>
          </div>
          <button className="bk-x" onClick={onClose} aria-label="close"><Ic d={BK_ICON.x} size={15} /></button>
        </div>
        <div className="bk-drawer-body">{children}</div>
        {footer && <div className="bk-drawer-foot">{footer}</div>}
      </aside>
    </div>
  );
};

export const MiniKpi: React.FC<{ label: React.ReactNode; value: React.ReactNode; tone?: 'warn' | 'bad' | 'good' }> = ({ label, value, tone }) => (
  <div className="bk-mini-kpi">
    <div className="l">{label}</div>
    <div className={`v${tone ? ` ${tone}` : ''}`}>{value}</div>
  </div>
);

export const EmptyState: React.FC<{ title: React.ReactNode; text?: React.ReactNode; action?: React.ReactNode }> = ({ title, text, action }) => (
  <div className="bk-empty">
    <div className="t">{title}</div>
    {text && <div>{text}</div>}
    {action && <div style={{ marginTop: 12 }}>{action}</div>}
  </div>
);

/** Ошибка API → текст (у ApiError уже человекочитаемый message от бэкенда). */
export const errMsg = (e: any, fallback: string) => (e?.message && typeof e.message === 'string' ? e.message : fallback);
