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
import { LottieIcon } from '../components/LottieIcon';

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

export type ShowPromptOptions = {
  title?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
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

type PromptModalState = {
  title?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (value: string | null) => void;
} | null;

type AlertModalContextValue = {
  showAlert: (message: string, options?: ShowAlertOptions) => void;
  showConfirm: (message: string, options?: ShowConfirmOptions) => Promise<boolean>;
  showPrompt: (options?: ShowPromptOptions) => Promise<string | null>;
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
      if (e.key === 'Escape' || e.key === 'Enter') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const resolvedTitle =
    state.title ??
    (state.variant === 'error'
      ? t('crm.alertModal.errorTitle')
      : t('crm.alertModal.defaultTitle'));

  const isError = state.variant === 'error';

  return (
    <div
      className="fixed inset-0 z-[8500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-alert-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-[16px] border border-[#e7e7e7] bg-white shadow-[0_24px_64px_rgba(0,0,0,0.14)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
          <div className="flex items-center gap-2 min-w-0">
            {state.variant === 'success' || isError ? (
              <LottieIcon
                name={state.variant === 'success' ? 'success-check' : 'error-alert'}
                size={30}
                loop={false}
                className="shrink-0"
              />
            ) : (
              <span
                aria-hidden="true"
                className="shrink-0 w-[26px] h-[26px] rounded-full bg-[#f0f0f0] text-[#555] flex items-center justify-center text-[13px] font-semibold italic font-serif"
              >
                i
              </span>
            )}
            <h2 id="global-alert-modal-title" className="text-[15px] font-semibold text-[#222] leading-snug truncate">
              {resolvedTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#888] hover:bg-[#f0f0f0] hover:text-[#222] transition-colors text-lg leading-none"
            aria-label={t('crm.alertModal.ok')}
          >
            ×
          </button>
        </div>
        {/* Body */}
        <div className="px-5 py-4">
          <p
            className={
              isError
                ? 'rounded-[10px] border border-[#e8b4bb] bg-[#fbecef] px-3 py-2.5 text-[13px] text-[#9a1f31] leading-relaxed whitespace-pre-wrap break-words'
                : 'text-[13px] text-[#444] leading-relaxed whitespace-pre-wrap break-words'
            }
          >
            {state.message}
          </p>
        </div>
        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#f0f0f0] bg-[#fafafa]">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="rounded-[8px] border border-[#222] bg-[#222] px-4 py-2 text-[12px] font-medium text-white hover:bg-[#111] transition-colors"
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
          <div className="flex items-center gap-2 min-w-0">
            {state.danger && <LottieIcon name="delete-trash" size={30} segment={[0, 32]} className="shrink-0" />}
            <h2 className="text-[15px] font-semibold text-[#222] leading-snug">
              {title}
            </h2>
          </div>
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

/* ── Prompt dialog (single text input) ───────────────────────────────────── */
function PromptDialog({
  state,
  onConfirm,
  onCancel,
}: {
  state: NonNullable<PromptModalState>;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(state.defaultValue ?? '');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const title = state.title ?? t('crm.promptModal.defaultTitle', { defaultValue: 'Введите значение' });
  const confirmLabel = state.confirmLabel ?? t('crm.promptModal.confirm', { defaultValue: 'ОК' });
  const cancelLabel = state.cancelLabel ?? t('crm.confirmModal.cancel', { defaultValue: 'Отмена' });

  const submit = () => {
    if (!value.trim()) return;
    onConfirm(value.trim());
  };

  return (
    <div
      className="fixed inset-0 z-[8600] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <form
        className="w-full max-w-sm rounded-[16px] border border-[#e7e7e7] bg-white shadow-[0_24px_64px_rgba(0,0,0,0.14)] overflow-hidden"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
          <h2 className="text-[15px] font-semibold text-[#222] leading-snug">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#888] hover:bg-[#f0f0f0] hover:text-[#222] transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4">
          {state.label && (
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[#888]">
              {state.label}
            </label>
          )}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={state.placeholder}
            className="w-full rounded-[10px] border border-[#e7e7e7] bg-white px-3 py-2 text-[13px] text-[#222] outline-none focus:border-[#999] transition-colors"
          />
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#f0f0f0] bg-[#fafafa]">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[8px] border border-[#e7e7e7] bg-white px-4 py-2 text-[12px] font-medium text-[#555] hover:border-[#ccc] hover:bg-white transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            className="rounded-[8px] border border-[#222] bg-[#222] px-4 py-2 text-[12px] font-medium text-white hover:bg-[#111] transition-colors disabled:opacity-50 disabled:cursor-default"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
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
  const [promptState, setPromptState] = useState<PromptModalState>(null);
  const confirmResolveRef = useRef<((v: boolean) => void) | null>(null);
  const promptResolveRef = useRef<((v: string | null) => void) | null>(null);

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

  const showPrompt = useCallback(
    (options?: ShowPromptOptions): Promise<string | null> => {
      return new Promise<string | null>((resolve) => {
        promptResolveRef.current = resolve;
        setPromptState({
          title: options?.title,
          label: options?.label,
          placeholder: options?.placeholder,
          defaultValue: options?.defaultValue,
          confirmLabel: options?.confirmLabel,
          cancelLabel: options?.cancelLabel,
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

  const handlePromptConfirm = useCallback((v: string) => {
    promptResolveRef.current?.(v);
    promptResolveRef.current = null;
    setPromptState(null);
  }, []);

  const handlePromptCancel = useCallback(() => {
    promptResolveRef.current?.(null);
    promptResolveRef.current = null;
    setPromptState(null);
  }, []);

  const value = useMemo(
    () => ({ showAlert, showConfirm, showPrompt }),
    [showAlert, showConfirm, showPrompt],
  );

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
      {promptState ? (
        <PromptDialog
          state={promptState}
          onConfirm={handlePromptConfirm}
          onCancel={handlePromptCancel}
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
