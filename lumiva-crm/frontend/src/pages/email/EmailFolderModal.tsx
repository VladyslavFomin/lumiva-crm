import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

export type EmailFolderModalProps = {
  open: boolean;
  title: string;
  initialName?: string;
  hint?: string;
  submitLabel: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void | Promise<void>;
};

/**
 * Создание / переименование папки — модальное окно в стиле CRM (без window.prompt).
 */
export const EmailFolderModal: React.FC<EmailFolderModalProps> = ({
  open,
  title,
  initialName = '',
  hint,
  submitLabel,
  busy = false,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    void onSubmit(trimmed);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-900/50 p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 bg-slate-50/90 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
        <form onSubmit={handleSubmit} className="px-4 py-4 sm:px-5">
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
            {t('crm.email.inbox.folderNameLabel', { defaultValue: 'Название' })}
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-teal-500/30 focus:border-teal-500 focus:ring-2"
            placeholder={t('crm.email.inbox.folderNamePlaceholder', { defaultValue: 'Например: Клиенты' })}
            maxLength={255}
          />
          <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 bg-white pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              {t('crm.common.cancel')}
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="rounded-full border border-lumiva-accent bg-lumiva-accent px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-lumiva-accent-soft disabled:opacity-40"
            >
              {busy ? '…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};
