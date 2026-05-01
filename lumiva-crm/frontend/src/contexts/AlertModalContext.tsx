import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

export type AlertModalVariant = 'info' | 'error' | 'success';

export type ShowAlertOptions = {
  title?: string;
  variant?: AlertModalVariant;
};

type AlertModalState = {
  message: string;
  title?: string;
  variant: AlertModalVariant;
} | null;

type AlertModalContextValue = {
  showAlert: (message: string, options?: ShowAlertOptions) => void;
};

const AlertModalContext = createContext<AlertModalContextValue | null>(null);

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
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/65 backdrop-blur-[2px]"
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

export function AlertModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<AlertModalState>(null);

  const showAlert = useCallback(
    (message: string, options?: ShowAlertOptions) => {
      setState({
        message,
        title: options?.title,
        variant: options?.variant ?? 'info',
      });
    },
    [],
  );

  const close = useCallback(() => setState(null), []);

  const value = useMemo(() => ({ showAlert }), [showAlert]);

  return (
    <AlertModalContext.Provider value={value}>
      {children}
      {state ? <AlertModalDialog state={state} onClose={close} /> : null}
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
