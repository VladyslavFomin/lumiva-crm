import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pillStyleFromHex } from './useProjectStatuses';

export type PillOption = { value: string; label: string; color: string };

type StatusPillProps = {
  value: string;
  label: string;
  color: string;
  options: PillOption[];
  onChange: (value: string) => void;
  big?: boolean;
  disabled?: boolean;
};

/** Дропдаун-пилюля со статусом/приоритетом — цвет берётся из hex (тенантский справочник),
 * а не из фиксированного набора CSS-классов, как в исходном макете. */
export const StatusPill: React.FC<StatusPillProps> = ({
  value,
  label,
  color,
  options,
  onChange,
  big,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const style = pillStyleFromHex(color);

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className={big ? 'pd-status' : 'pd-pill'}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        style={{
          background: style.background,
          color: style.color,
          borderColor: style.borderColor,
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        <span className="dot" style={{ background: style.dot }} />
        {label}
      </button>
      {open && (
        <div className="pd-menu">
          {options.map((opt) => {
            const optStyle = pillStyleFromHex(opt.color);
            return (
              <button
                key={opt.value}
                type="button"
                className={opt.value === value ? 'on' : undefined}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: optStyle.dot,
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
};

type FieldProps = {
  label: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
};

export const Field: React.FC<FieldProps> = ({ label, wide, children }) => (
  <div className={wide ? 'pd-field wide' : 'pd-field'}>
    <label>{label}</label>
    {children}
  </div>
);

type CardProps = {
  title?: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  pad?: boolean;
};

export const Card: React.FC<CardProps> = ({ title, hint, action, children, pad }) => (
  <section className="pd-card">
    {title && (
      <div className="pd-card-head">
        <h3>{title}</h3>
        <div className="sp" />
        {hint && <span className="hint">{hint}</span>}
        {action}
      </div>
    )}
    {pad ? <div className="pd-card-body">{children}</div> : children}
  </section>
);

type DotsMenuProps = {
  items: Array<{ key: string; label: string; onClick: () => void; danger?: boolean }>;
};

/** Меню "···" в шапке — тот же паттерн fixed-position popup, что и у "···" вкладки таблицы в ProjectsViewsBar. */
export const DotsMenu: React.FC<DotsMenuProps> = ({ items }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="app-topbar-btn"
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          border: '1px solid var(--line-2)',
          background: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
        aria-label={t('crm.projects.dotsMenuAria')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {open && (
        <div className="pd-menu" style={{ right: 0, left: 'auto' }}>
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.danger ? 'danger' : undefined}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
