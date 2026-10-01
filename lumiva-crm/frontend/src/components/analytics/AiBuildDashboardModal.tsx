import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type AiBuildMode = 'replace' | 'append';

/**
 * «Разобрать через ИИ» с пожеланиями: пользователь пишет, какие блоки нужны (или кликает
 * подсказки), ИИ строит дашборд по реальным данным. Режим — заменить блоки или добавить к текущим.
 */
export const AiBuildDashboardModal: React.FC<{
  open: boolean;
  busy?: boolean;
  error?: string | null;
  /** Блоки на текущей вкладке — от этого зависит выбор режима по умолчанию. */
  currentBlocks: number;
  /** Подсказка про карту — только там, где есть блок «Карта». */
  supportsMap?: boolean;
  /** Что заменяется в режиме replace: вкладка (проекты/workspace) или все вкладки (продажи/лиды). */
  replaceScope?: 'tab' | 'all';
  onClose: () => void;
  onSubmit: (input: { instructions: string; mode: AiBuildMode }) => void;
}> = ({ open, busy, error, currentBlocks, supportsMap, replaceScope = 'tab', onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [instructions, setInstructions] = useState('');
  const [mode, setMode] = useState<AiBuildMode>('replace');
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode(currentBlocks > 0 ? 'append' : 'replace');
    window.setTimeout(() => textRef.current?.focus(), 50);
  }, [open, currentBlocks]);

  if (!open) return null;

  const chips = [
    'kpi',
    'line',
    'bar',
    'donut',
    'table',
    'pivot',
    'formula',
    ...(supportsMap ? ['mapWorld', 'mapEurope', 'mapCountry'] : []),
    'note',
  ];
  const addChip = (key: string) => {
    const phrase = t(`crm.projects.analytics.aiBuild.chips.${key}.text`);
    setInstructions((prev) => (prev.trim() ? `${prev.trim().replace(/[.;,]?$/, ';')} ${phrase}` : phrase));
    textRef.current?.focus();
  };

  return (
    <div
      className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-xl rounded-2xl bg-white p-5 text-[#222] shadow-[0_30px_80px_rgba(0,0,0,0.18)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold tracking-[-0.02em]">
              <span aria-hidden className="text-[#7c3aed]">✦</span>
              {t('crm.projects.analytics.aiBuild.title')}
            </h3>
            <p className="mt-1 text-sm leading-6 text-neutral-500">{t('crm.projects.analytics.aiBuild.subtitle')}</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} disabled={busy} aria-label="Close">
            ✕
          </button>
        </div>

        <textarea
          ref={textRef}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          maxLength={2000}
          rows={5}
          placeholder={t('crm.projects.analytics.aiBuild.placeholder')}
          className="mt-4 w-full resize-y rounded-xl border border-neutral-200 px-3 py-2.5 text-sm leading-6 outline-none focus:border-neutral-400"
        />

        <div className="mt-2 text-[11px] uppercase tracking-[0.12em] text-neutral-400">
          {t('crm.projects.analytics.aiBuild.chipsLabel')}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {chips.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => addChip(key)}
              className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-700 transition hover:border-neutral-400 hover:bg-white"
            >
              + {t(`crm.projects.analytics.aiBuild.chips.${key}.label`)}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(['append', 'replace'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={
                mode === m
                  ? 'rounded-xl border border-[#222] bg-neutral-50 px-3 py-2 text-left text-xs'
                  : 'rounded-xl border border-neutral-200 px-3 py-2 text-left text-xs hover:border-neutral-300'
              }
            >
              <span className="block font-medium text-[#222]">{t(`crm.projects.analytics.aiBuild.mode.${m}`)}</span>
              <span className="block text-[11px] text-neutral-500">
                {m === 'replace'
                  ? t(`crm.projects.analytics.aiBuild.mode.replaceHint_${replaceScope}`, { count: currentBlocks })
                  : t('crm.projects.analytics.aiBuild.mode.appendHint')}
              </span>
            </button>
          ))}
        </div>

        {error && !busy && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
        )}

        <div className="mt-5 flex items-center justify-between gap-2">
          <span className="text-[11px] text-neutral-400">{t('crm.projects.analytics.aiBuild.footnote')}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">
              {t('crm.projects.analytics.tabs.cancel')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSubmit({ instructions: instructions.trim(), mode })}
              className="btn-primary"
            >
              {busy ? t('crm.projects.analytics.aiBuild.building') : t('crm.projects.analytics.aiBuild.submit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
