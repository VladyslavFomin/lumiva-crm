import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

export type AlertModalVariant = 'info' | 'error' | 'success';

export type ShowAlertOptions = {
  title?: string;
  variant?: AlertModalVariant;
};

export type ShowConfirmOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type AlertModalState = {
  message: string;
  title?: string;
  variant: AlertModalVariant;
} | null;

type ConfirmModalState = {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (value: boolean) => void;
} | null;

type AlertModalContextValue = {
  showAlert: (message: string, options?: ShowAlertOptions) => void;
  showConfirm: (message: string, options?: ShowConfirmOptions) => Promise<boolean>;
};

const AlertModalContext = createContext<AlertModalContextValue | null>(null);

/* ── Alert dialog (notification only) ─────────────────────────────────── */
function AlertModalDialog({
  state,
  onClose,
}: {
  state: NonNullable<AlertModalState>;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const resolvedTitle =
    state.title ??
    (state.variant === 'error'
      ? t('crm.alertModal.errorTitle')
      : t('crm.alertModal.defaultTitle'));

  const ring =
    state.variant === 'error'
      ? 'border-rose-500/50 ring-1 ring-rose-500/20'
      : state.variant === 'success'
        ? 'border-emerald-500/40 ring-1 ring-emerald-500/15'
        : 'border-slate-600/80 ring-1 ring-slate-500/15';

  return (
    <div
      className="fixed inset-0 z-[8500] flex items-center justify-center p-4 bg-black/65 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-alert-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-md rounded-2xl border bg-slate-900 shadow-2xl shadow-black/50 overflow-hidden ${ring}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800/90 px-5 py-4">
          <h2
            id="global-alert-modal-title"
            className="text-base font-semibold text-slate-50 leading-snug pr-2"
          >
            {resolvedTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            aria-label={t('crm.alertModal.ok')}
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
            <p className="text-[13px] text-slate-900 leading-relaxed whitespace-pre-wrap break-words">
              {state.message}
            </p>
          </div>
        </div>
        <div className="border-t border-slate-800/90 px-5 py-3 flex justify-end bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl px-5 py-2 text-[12px] font-semibold bg-lumiva-accent text-slate-950 hover:bg-lumiva-accent-soft transition-colors"
          >
            {t('crm.alertModal.ok')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Confirm dialog (yes / no) ─────────────────────────────────────────── */
function ConfirmDialog({
  state,
  onConfirm,
  onCancel,
}: {
  state: NonNullable<ConfirmModalState>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onConfirm, onCancel]);

  const title = state.title ?? t('crm.confirmModal.defaultTitle', { defaultValue: 'Подтверждение' });
  const confirmLabel = state.confirmLabel ?? t('crm.confirmModal.confirm', { defaultValue: 'Подтвердить' });
  const cancelLabel = state.cancelLabel ?? t('crm.confirmModal.cancel', { defaultValue: 'Отмена' });

  return (
    <div
      className="fixed inset-0 z-[8600] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-[16px] border border-[#e7e7e7] bg-white shadow-[0_24px_64px_rgba(0,0,0,0.14)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
          <h2 className="text-[15px] font-semibold text-[#222] leading-snug">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#888] hover:bg-[#f0f0f0] hover:text-[#222] transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-[13px] text-[#444] leading-relaxed">
            {state.message}
          </p>
        </div>
        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#f0f0f0] bg-[#fafafa]">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[8px] border border-[#e7e7e7] bg-white px-4 py-2 text-[12px] font-medium text-[#555] hover:border-[#ccc] hover:bg-white transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              state.danger
                ? 'rounded-[8px] border border-[#e8b4bb] bg-[#fbecef] px-4 py-2 text-[12px] font-medium text-[#9a1f31] hover:bg-[#f7d8dd] transition-colors'
                : 'rounded-[8px] border border-[#222] bg-[#222] px-4 py-2 text-[12px] font-medium text-white hover:bg-[#111] transition-colors'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Provider ──────────────────────────────────────────────────────────── */
export function AlertModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [alertState, setAlertState] = useState<AlertModalState>(null);
  const [confirmState, setConfirmState] = useState<ConfirmModalState>(null);
  const confirmResolveRef = useRef<((v: boolean) => void) | null>(null);

  const showAlert = useCallback(
    (message: string, options?: ShowAlertOptions) => {
      setAlertState({
        message,
        title: options?.title,
        variant: options?.variant ?? 'info',
      });
    },
    [],
  );

  const showConfirm = useCallback(
    (message: string, options?: ShowConfirmOptions): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        confirmResolveRef.current = resolve;
        setConfirmState({
          message,
          title: options?.title,
          confirmLabel: options?.confirmLabel,
          cancelLabel: options?.cancelLabel,
          danger: options?.danger ?? false,
          resolve,
        });
      });
    },
    [],
  );

  const closeAlert = useCallback(() => setAlertState(null), []);

  const handleConfirm = useCallback(() => {
    confirmResolveRef.current?.(true);
    confirmResolveRef.current = null;
    setConfirmState(null);
  }, []);

  const handleCancel = useCallback(() => {
    confirmResolveRef.current?.(false);
    confirmResolveRef.current = null;
    setConfirmState(null);
  }, []);

  const value = useMemo(() => ({ showAlert, showConfirm }), [showAlert, showConfirm]);

  return (
    <AlertModalContext.Provider value={value}>
      {children}
      {alertState ? <AlertModalDialog state={alertState} onClose={closeAlert} /> : null}
      {confirmState ? (
        <ConfirmDialog
          state={confirmState}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      ) : null}
    </AlertModalContext.Provider>
  );
}

export function useAlertModal(): AlertModalContextValue {
  const ctx = useContext(AlertModalContext);
  if (!ctx) {
    throw new Error('useAlertModal must be used within AlertModalProvider');
  }
  return ctx;
}
