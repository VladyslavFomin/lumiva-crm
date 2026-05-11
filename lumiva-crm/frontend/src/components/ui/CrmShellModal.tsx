import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export type CrmShellModalProps = {
  open: boolean;
  title: string;
  message: string;
  variant?: 'info' | 'error';
  /** Если есть — показываем вторую кнопку «Отмена» */
  cancelLabel?: string;
  confirmLabel?: string;
  /** danger — мягкая розовая кнопка с тёмным текстом (удаление); default — чёрная заливка */
  confirmTone?: 'default' | 'danger';
  onClose: () => void;
  onConfirm?: () => void;
};

/**
 * Единое модальное окно в стиле CRM (как AI / почтовый композер): белая панель, тень, оверлей.
 */
export const CrmShellModal: React.FC<CrmShellModalProps> = ({
  open,
  title,
  message,
  variant = 'info',
  cancelLabel,
  confirmLabel = 'OK',
  confirmTone = 'default',
  onClose,
  onConfirm,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const isConfirm = Boolean(cancelLabel);

  const cancelClass =
    'rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-none transition hover:border-slate-400 hover:bg-slate-50';
  const confirmPrimaryClass =
    'rounded-full border border-lumiva-accent bg-lumiva-accent px-4 py-2 text-xs font-semibold text-white shadow-none transition hover:bg-lumiva-accent-soft';
  const confirmDangerClass =
    'rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-950 shadow-none transition hover:border-rose-400 hover:bg-rose-100';

  return createPortal(
    <div
      className="fixed inset-0 z-[8500] flex items-end justify-center bg-slate-900/50 p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal
      aria-labelledby="crm-shell-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={`border-b px-4 py-3 sm:px-5 ${
            variant === 'error' ? 'border-rose-100 bg-rose-50/80' : 'border-slate-100 bg-slate-50/80'
          }`}
        >
          <h2 id="crm-shell-modal-title" className="text-sm font-semibold text-slate-900">
            {title}
          </h2>
        </div>
        <div className="max-h-[min(60vh,320px)] overflow-y-auto px-4 py-4 text-sm leading-relaxed text-slate-700 sm:px-5">
          <p className="whitespace-pre-wrap">{message}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-white px-4 py-3 sm:px-5">
          {isConfirm ? (
            <>
              <button type="button" onClick={onClose} className={cancelClass}>
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm?.();
                  onClose();
                }}
                className={confirmTone === 'danger' ? confirmDangerClass : confirmPrimaryClass}
              >
                {confirmLabel}
              </button>
            </>
          ) : (
            <button type="button" onClick={onClose} className={confirmPrimaryClass}>
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
