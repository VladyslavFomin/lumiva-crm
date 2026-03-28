import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchMarketingIntegrations,
  syncMarketingIntegration,
  type MarketingIntegrationRow,
} from '../../api/marketing';
import { marketingDataSourceLabel } from '../../utils/marketingDataSourceLabel';

export const MarketingIntegrationsPage: React.FC = () => {
  const { t } = useTranslation();
  const [list, setList] = useState<MarketingIntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  /** null — нет сообщения; число — сколько строк записано за последний успешный синк (0 = успех, но строк нет). */
  const [lastSyncRows, setLastSyncRows] = useState<number | null>(null);

  const load = useCallback((): Promise<void> => {
    setLoading(true);
    setError(null);
    return fetchMarketingIntegrations()
      .then((data) => {
        setList(data);
      })
      .catch((e: { message?: string }) => {
        setError(e?.message || 'Load failed');
        throw e;
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSync = async (id: string) => {
    setSyncingId(id);
    setError(null);
    setLastSyncRows(null);
    try {
      const res = await syncMarketingIntegration(id);
      setLastSyncRows(res.rowsSaved);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sync failed';
      setError(msg);
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 pb-8">
        <div>
          <h1 className="text-lg font-semibold text-slate-50">
            {t('crm.nav.marketingIntegrations', { defaultValue: 'Интеграции маркетинга' })}
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            {t('crm.marketingIntegrations.hint', {
              defaultValue:
                'Синхронизация подтягивает данные в отчёт трафика (расширенные метрики по dataSource).',
            })}
          </p>
        </div>
        {loading && (
          <div className="text-[11px] text-slate-400">
            {t('crm.common.loading', { defaultValue: 'Загрузка…' })}
          </div>
        )}
        {error && <div className="text-[11px] text-red-400">{error}</div>}
        {lastSyncRows !== null && (
          <div className="text-[11px] text-emerald-400/95 rounded-2xl border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
            {lastSyncRows > 0 ? (
              <>
                <span>Синхронизировано строк:</span>
                <span className="text-base font-semibold tabular-nums text-emerald-200 min-w-[1ch]">
                  {lastSyncRows}
                </span>
              </>
            ) : (
              <span>
                {t('crm.marketingIntegrations.syncZero', {
                  defaultValue:
                    'Синхронизация завершена, новых строк: 0 (пустой ответ API за период, нет прав к счётчику или интеграция пропущена — см. логи backend).',
                })}
              </span>
            )}
          </div>
        )}
        {!loading && list.length === 0 && (
          <div className="text-[11px] text-slate-500 rounded-2xl border border-slate-800 bg-slate-950/50 px-3 py-2">
            {t('crm.marketingIntegrations.empty', {
              defaultValue: 'Интеграций пока нет. Добавьте их через API или форму (если доступна).',
            })}
          </div>
        )}
        <div className="space-y-2">
          {list.map((row) => (
            <div
              key={row.id}
              className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 flex flex-wrap items-center gap-3 justify-between"
            >
              <div className="min-w-0">
                <div className="text-slate-100 font-medium truncate">{row.name}</div>
                <div className="text-[11px] text-slate-500">
                  {marketingDataSourceLabel(t, row.provider)} · {row.kind} ·{' '}
                  {row.primaryId ? `${row.primaryId} · ` : ''}
                  {row.isActive
                    ? t('crm.common.active', { defaultValue: 'активна' })
                    : t('crm.common.inactive', { defaultValue: 'выкл' })}
                </div>
              </div>
              <button
                type="button"
                disabled={!row.isActive || syncingId !== null}
                onClick={() => onSync(row.id)}
                className="shrink-0 text-[11px] px-3 py-1.5 rounded-xl bg-white text-slate-900 disabled:opacity-40"
              >
                {syncingId === row.id
                  ? t('crm.common.syncing', { defaultValue: 'Синхронизация…' })
                  : t('crm.common.sync', { defaultValue: 'Синхронизировать' })}
              </button>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-600 pt-4 border-t border-slate-800/80 mt-6">
          CRM UI build:{' '}
          <code className="text-slate-500">{__CRM_FRONT_BUILD__}</code>
          {' · '}
          API: маркетинг <code className="text-slate-500">GET /v1/marketing/traffic</code>,{' '}
          <code className="text-slate-500">POST /v1/marketing/integrations/:id/sync</code>
        </p>
      </div>
    </MainLayout>
  );
};
