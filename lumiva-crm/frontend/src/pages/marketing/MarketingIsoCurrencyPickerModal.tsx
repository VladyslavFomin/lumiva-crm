import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MARKETING_ISO_CURRENCY_SUGGESTIONS } from './marketingDisplayCurrencyStorage';

const btnGhost =
  'rounded-lg border border-[#222222]/15 bg-white px-3 py-2 text-[12px] font-medium text-[#222222] hover:bg-slate-50';
const btnPrimary =
  'rounded-lg bg-[#222222] px-4 py-2 text-[12px] font-semibold text-white hover:bg-black';

type Props = {
  open: boolean;
  onClose: () => void;
  value: string;
  onConfirm: (code: string) => void | Promise<void>;
  title: string;
  /** Доп. коды из данных (например уже сохранённые в интеграции). */
  extraCodes?: string[];
};

export const MarketingIsoCurrencyPickerModal: React.FC<Props> = ({
  open,
  onClose,
  value,
  onConfirm,
  title,
  extraCodes = [],
}) => {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState(value.toUpperCase().slice(0, 8));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(value.toUpperCase().slice(0, 8));
      setQ('');
      setBusy(false);
    }
  }, [open, value]);

  const list = useMemo(() => {
    const u = new Set<string>([
      ...MARKETING_ISO_CURRENCY_SUGGESTIONS,
      ...extraCodes.map((c) => c.toUpperCase()),
    ]);
    const qq = q.trim().toUpperCase();
    const arr = [...u].sort();
    if (!qq) return arr;
    return arr.filter((c) => c.includes(qq));
  }, [q, extraCodes]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="iso-cur-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#222222]/12 bg-white shadow-[0_24px_80px_rgba(34,34,34,0.18)] overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[#222222]/10 px-5 py-4">
          <h2 id="iso-cur-title" className="text-sm font-semibold text-[#222222]">
            {title}
          </h2>
          <p className="text-[11px] text-[#222222]/50 mt-1">
            {t('crm.marketingCurrency.iso.hint', {
              defaultValue: 'Выберите ISO-код валюты. Можно отфильтровать список.',
            })}
          </p>
        </div>
        <div className="px-5 py-3 space-y-2">
          <input
            className="w-full rounded-xl border border-[#222222]/16 px-3 py-2 text-[13px] outline-none focus:border-[#222222] focus:ring-2 focus:ring-[#222222]/10"
            placeholder={t('crm.marketingCurrency.iso.search', { defaultValue: 'Поиск…' })}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <div className="max-h-56 overflow-y-auto rounded-xl border border-[#222222]/10 divide-y divide-[#222222]/8">
            {list.length === 0 ? (
              <div className="px-3 py-6 text-center text-[11px] text-[#222222]/45">
                {t('crm.marketingCurrency.iso.empty', { defaultValue: 'Нет совпадений' })}
              </div>
            ) : (
              list.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDraft(c)}
                  className={`w-full text-left px-3 py-2.5 text-[13px] font-medium transition ${
                    draft === c ? 'bg-[#222222] text-white' : 'text-[#222222] hover:bg-slate-50'
                  }`}
                >
                  {c}
                </button>
              ))
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-4 bg-slate-50/80 border-t border-[#222222]/10">
          <button type="button" className={btnGhost} onClick={onClose}>
            {t('crm.common.cancel', { defaultValue: 'Отмена' })}
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={busy}
            onClick={async () => {
              const code = draft.trim().toUpperCase().slice(0, 8) || 'EUR';
              setBusy(true);
              try {
                await Promise.resolve(onConfirm(code));
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy
              ? t('crm.common.loading', { defaultValue: '…' })
              : t('crm.common.save', { defaultValue: 'Сохранить' })}
          </button>
        </div>
      </div>
    </div>
  );
};
