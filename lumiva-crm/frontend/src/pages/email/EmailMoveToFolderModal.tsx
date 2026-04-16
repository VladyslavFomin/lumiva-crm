import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { EmailFolder } from '../../api/email';

export type EmailMoveToFolderModalProps = {
  open: boolean;
  folders: EmailFolder[];
  onClose: () => void;
  onPick: (folderId: string) => void | Promise<void>;
  folderLabel: (f: EmailFolder) => string;
  folderRowIcon: (f: EmailFolder) => React.ReactNode;
};

export const EmailMoveToFolderModal: React.FC<EmailMoveToFolderModalProps> = ({
  open,
  folders,
  onClose,
  onPick,
  folderLabel,
  folderRowIcon,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const sorted = [...folders].sort((a, b) => {
    const order = (k: string | null) => (k === 'inbox' ? 0 : k === 'sent' ? 1 : k === 'trash' ? 2 : 3);
    const d = order(a.systemKey) - order(b.systemKey);
    if (d !== 0) return d;
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  });

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
        className="max-h-[min(70vh,480px)] w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 bg-slate-50/90 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{t('crm.email.inbox.moveToFolderTitle')}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{t('crm.email.inbox.moveToFolderHint')}</p>
        </div>
        <ul className="max-h-[min(56vh,400px)] overflow-y-auto p-2">
          {sorted.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    try {
                      await Promise.resolve(onPick(f.id));
                    } finally {
                      onClose();
                    }
                  })();
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm text-slate-800 transition hover:border-slate-200 hover:bg-slate-50"
              >
                <span className="flex shrink-0 text-slate-600" aria-hidden>
                  {folderRowIcon(f)}
                </span>
                <span className="truncate">{folderLabel(f)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t('crm.common.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
