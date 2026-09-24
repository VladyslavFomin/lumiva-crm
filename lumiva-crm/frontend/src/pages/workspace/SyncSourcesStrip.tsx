import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addSyncSource,
  getSyncSourcesFromMeta,
  refreshAllSyncSources,
  refreshSyncSource,
  removeSyncSource,
  updateSyncSource,
  type SyncSourceDto,
} from '../../api/customObjects';

const PROVIDERS: Array<{ id: string; label: string }> = [
  { id: 'google_ads', label: 'Google Ads' },
  { id: 'meta_ads', label: 'Meta Ads' },
  { id: 'yandex_direct', label: 'Яндекс.Директ' },
  { id: 'vk_ads', label: 'VK Ads' },
  { id: 'ga4', label: 'GA4' },
  { id: 'yandex_metrika', label: 'Яндекс.Метрика' },
];
const CURRENCIES = ['', 'EUR', 'USD', 'TRY', 'GBP', 'RUB', 'PLN', 'CHF'];

const btn =
  'rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium text-[#222] hover:bg-neutral-50 disabled:opacity-50';
const linkBtn = 'text-[11px] text-neutral-500 underline-offset-2 hover:underline disabled:opacity-50';

function sourceTitle(s: SyncSourceDto, t: (k: string) => string): string {
  if (s.label) return s.label;
  if (s.kind === 'marketing_monthly') return t('crm.workspace.syncSources.kinds.monthly');
  if (s.kind === 'marketing_rows') {
    const names = ((s.params?.providers as string[]) || []).map((id) => PROVIDERS.find((p) => p.id === id)?.label || id);
    return names.join(' + ') || t('crm.workspace.syncSources.kinds.rows');
  }
  return t('crm.workspace.syncSources.kinds.import');
}

/** Источники синхронизации таблицы: статус, «обновить», вкл/выкл, удаление и «+ Источник». */
export const SyncSourcesStrip: React.FC<{
  objectId: string;
  meta: Record<string, any> | null | undefined;
  onChanged: () => void | Promise<void>;
}> = ({ objectId, meta, onChanged }) => {
  const { t, i18n } = useTranslation();
  const sources = getSyncSourcesFromMeta(meta);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string; hint?: string; message?: string }>) => {
    setBusy(key);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) setError(res.message || res.hint || res.error || t('crm.workspace.syncSources.failed'));
      await onChanged();
      return res.ok;
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.workspace.syncSources.failed'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(i18n.language) : t('crm.workspace.syncSources.never'));
  const schedule = (s: SyncSourceDto) =>
    s.schedule.type === 'nightly'
      ? t('crm.workspace.syncSources.nightly')
      : t('crm.workspace.syncSources.everyHours', { count: Math.max(1, Math.round(s.schedule.everyMinutes / 60)) });

  return (
    <div className="mt-2 space-y-1 text-[12px] text-neutral-500">
      {sources.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-[#222]">{sourceTitle(s, t)}</span>
          <span>
            {t('crm.workspace.syncSources.updatedAt', { date: when(s.lastRefreshAt) })}
            {s.lastRecordCount != null ? ` · ${t('crm.workspace.syncSources.rows', { count: s.lastRecordCount })}` : ''}
            {' · '}
            {s.autoRefresh ? schedule(s) : t('crm.workspace.syncSources.autoOff')}
          </span>
          {s.lastRefreshStatus === 'error' && (
            <span className="text-rose-600">
              {t('crm.workspace.syncSources.lastFailed')}
              {s.lastRefreshError ? `: ${s.lastRefreshError}` : ''}
            </span>
          )}
          <button type="button" disabled={busy !== null} className={btn} onClick={() => run(`r-${s.id}`, () => refreshSyncSource(objectId, s.id))}>
            {busy === `r-${s.id}` ? t('crm.workspace.syncSources.refreshing') : t('crm.workspace.syncSources.refresh')}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            className={linkBtn}
            onClick={() => run(`t-${s.id}`, () => updateSyncSource(objectId, s.id, { autoRefresh: !s.autoRefresh }))}
          >
            {s.autoRefresh ? t('crm.workspace.syncSources.turnOff') : t('crm.workspace.syncSources.turnOn')}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            className={linkBtn}
            onClick={() => {
              if (window.confirm(t('crm.workspace.syncSources.removeConfirm'))) {
                void run(`d-${s.id}`, () => removeSyncSource(objectId, s.id, false));
              }
            }}
          >
            {t('crm.workspace.syncSources.remove')}
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy !== null} className={btn} onClick={() => setDialog(true)}>
          + {t('crm.workspace.syncSources.add')}
        </button>
        {sources.length > 1 && (
          <button type="button" disabled={busy !== null} className={btn} onClick={() => run('all', () => refreshAllSyncSources(objectId))}>
            {busy === 'all' ? t('crm.workspace.syncSources.refreshing') : t('crm.workspace.syncSources.refreshAll')}
          </button>
        )}
        {error && <span className="text-rose-600">{error}</span>}
      </div>
      {dialog && (
        <AddSourceDialog
          onClose={() => setDialog(false)}
          onSubmit={async (params) => {
            const ok = await run('add', () => addSyncSource(objectId, { kind: 'marketing_rows', params }));
            if (ok) setDialog(false);
          }}
          busy={busy === 'add'}
        />
      )}
    </div>
  );
};

const AddSourceDialog: React.FC<{
  onClose: () => void;
  onSubmit: (params: Record<string, any>) => void | Promise<void>;
  busy: boolean;
}> = ({ onClose, onSubmit, busy }) => {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<string[]>([]);
  const [grain, setGrain] = useState<'daily' | 'campaign' | 'channel'>('daily');
  const [from, setFrom] = useState('');
  const [currency, setCurrency] = useState('');

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 text-[13px] text-[#222] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-[15px] font-semibold">{t('crm.workspace.syncSources.dialog.title')}</div>
        <div className="mb-1 text-[11px] uppercase tracking-wide text-neutral-400">{t('crm.workspace.syncSources.dialog.providers')}</div>
        <div className="mb-3 grid grid-cols-2 gap-1">
          {PROVIDERS.map((p) => (
            <label key={p.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={providers.includes(p.id)}
                onChange={(e) => setProviders((prev) => (e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id)))}
              />
              {p.label}
            </label>
          ))}
        </div>
        <label className="mb-3 block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-neutral-400">{t('crm.workspace.syncSources.dialog.grain')}</span>
          <select className="w-full rounded-lg border border-neutral-200 px-2 py-1.5" value={grain} onChange={(e) => setGrain(e.target.value as typeof grain)}>
            <option value="daily">{t('crm.workspace.syncSources.dialog.grainDaily')}</option>
            <option value="campaign">{t('crm.workspace.syncSources.dialog.grainCampaign')}</option>
            <option value="channel">{t('crm.workspace.syncSources.dialog.grainChannel')}</option>
          </select>
        </label>
        <label className="mb-3 block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-neutral-400">{t('crm.workspace.syncSources.dialog.from')}</span>
          <input type="date" className="w-full rounded-lg border border-neutral-200 px-2 py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-neutral-400">{t('crm.workspace.syncSources.dialog.currency')}</span>
          <select className="w-full rounded-lg border border-neutral-200 px-2 py-1.5" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c || t('crm.workspace.syncSources.dialog.currencyNone')}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-neutral-400">{t('crm.workspace.syncSources.dialog.currencyHint')}</span>
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded-lg px-3 py-1.5 text-neutral-500 hover:bg-neutral-50" onClick={onClose}>
            {t('crm.workspace.syncSources.dialog.cancel')}
          </button>
          <button
            type="button"
            disabled={busy || providers.length === 0}
            className="rounded-lg bg-[#222] px-3 py-1.5 font-medium text-white disabled:opacity-50"
            onClick={() => onSubmit({ providers, grain, ...(from ? { from } : {}), ...(currency ? { displayCurrency: currency } : {}) })}
          >
            {busy ? t('crm.workspace.syncSources.refreshing') : t('crm.workspace.syncSources.dialog.submit')}
          </button>
        </div>
      </div>
    </div>
  );
};
