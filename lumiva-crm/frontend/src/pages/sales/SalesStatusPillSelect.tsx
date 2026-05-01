import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { SaleStatus } from '../../api/sales';
import { SALE_STATUSES_ORDER, saleStatusPillClass } from './saleStatusUi';
import './salesStatusPills.css';

type Props = {
  value: SaleStatus;
  labels: Record<SaleStatus, string>;
  onChange: (next: SaleStatus) => void;
  /** Остановить всплытие (строка таблицы с onClick → navigate) */
  stopPropagationOnControl?: boolean;
  disabled?: boolean;
  /** Для выравнивания в узкой колонке */
  className?: string;
};

export const SalesStatusPillSelect: React.FC<Props> = ({
  value,
  labels,
  onChange,
  stopPropagationOnControl = true,
  disabled = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPos(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', close, true);
    };
  }, [open, close]);

  const openFromEvent = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (stopPropagationOnControl) e.stopPropagation();
    if (open) {
      close();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left });
    setOpen(true);
  };

  return (
    <div
      ref={rootRef}
      className={`sales-status-pills-scope relative inline-flex max-w-full ${className}`}
    >
      <button
        type="button"
        disabled={disabled}
        className={`${saleStatusPillClass(value)} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={openFromEvent}
      >
        <span className="dot" />
        {labels[value] ?? value}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{ opacity: 0.6, flexShrink: 0 }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && pos ? (
        <div
          className="lv-st-popover"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 60,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {SALE_STATUSES_ORDER.map((st) => (
            <button
              key={st}
              type="button"
              className="lv-st-popover-item"
              onClick={() => {
                onChange(st);
                close();
              }}
            >
              <span
                className={saleStatusPillClass(st)}
                style={{ pointerEvents: 'none' }}
              >
                <span className="dot" />
                {labels[st] ?? st}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
