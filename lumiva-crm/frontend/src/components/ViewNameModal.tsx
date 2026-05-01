import React, { useEffect, useState } from 'react';

export type ViewNameModalProps = {
  open: boolean;
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
};

/**
 * Модальное окно ввода названия вида (таблица / канбан / календарь) вместо window.prompt.
 */
export const ViewNameModal: React.FC<ViewNameModalProps> = ({
  open,
  title,
  label,
  initialValue = '',
  placeholder,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
}) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  if (!open) return null;

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="view-name-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-[0_24px_64px_rgba(15,23,42,0.18)] overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-2">
          <h2 id="view-name-modal-title" className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {label}
          </label>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
              if (e.key === 'Escape') onClose();
            }}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            placeholder={placeholder}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 bg-slate-50 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            className="rounded-xl bg-[#222222] px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-40 disabled:pointer-events-none"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
