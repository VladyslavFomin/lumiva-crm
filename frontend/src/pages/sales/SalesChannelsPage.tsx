// src/pages/sales/SalesChannelsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchSalesChannels,
  updateSalesChannel,
  deleteSalesChannel,
  type SalesChannel,
} from '../../api/salesChannels';
import { getLocale } from '../../i18n/utils';

export const SalesChannelsPage: React.FC = () => {
  const { t } = useTranslation();
  const locale = getLocale();
  const typeLabels: Record<SalesChannel['type'], string> = {
    b2b: t('crm.salesChannels.types.b2b'),
    ota: t('crm.salesChannels.types.ota'),
    direct: t('crm.salesChannels.types.direct'),
    gds: t('crm.salesChannels.types.gds'),
    other: t('crm.salesChannels.types.other'),
  };
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchSalesChannels()
      .then((items) => {
        if (!alive) return;
        setChannels(items.filter((c) => !c.isDeleted));
      })
      .catch((e: any) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.salesChannels.errors.load'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const totalAmount = useMemo(
    () => channels.reduce((s, c) => s + (c.totalSalesAmount || 0), 0),
    [channels],
  );
  const totalCount = useMemo(
    () => channels.reduce((s, c) => s + (c.totalSalesCount || 0), 0),
    [channels],
  );

  const handleToggle = async (ch: SalesChannel) => {
    setSavingId(ch.id);
    try {
      const updated = await updateSalesChannel(ch.id, {
        isEnabled: !ch.isEnabled,
      });
      setChannels((prev) =>
        prev.map((c) => (c.id === ch.id ? updated : c)),
      );
    } catch (e: any) {
      console.error(e);
      alert(e.message || t('crm.salesChannels.errors.toggle'));
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (ch: SalesChannel) => {
    if (
      !window.confirm(
        t('crm.salesChannels.deleteConfirm', { name: ch.name }),
      )
    ) {
      return;
    }
    setSavingId(ch.id);
    try {
      await deleteSalesChannel(ch.id);
      setChannels((prev) => prev.filter((c) => c.id !== ch.id));
    } catch (e: any) {
      console.error(e);
      alert(e.message || t('crm.salesChannels.errors.delete'));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        {/* Заголовок */}
        <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              {t('crm.salesChannels.kicker')}
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              {t('crm.salesChannels.title')}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {t('crm.salesChannels.subtitle')}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 text-[11px] text-slate-300">
            <div className="flex flex-wrap gap-2 justify-end">
              <span className="px-2 py-1 rounded-full bg-slate-900/80 border border-slate-800/80">
                {t('crm.salesChannels.summary.channels', {
                  count: channels.length,
                })}
              </span>
              <span className="px-2 py-1 rounded-full bg-slate-900/80 border border-slate-800/80">
                {t('crm.salesChannels.summary.sales', {
                  count: totalCount.toLocaleString(locale),
                })}
              </span>
              <span className="px-2 py-1 rounded-full bg-slate-900/80 border border-slate-800/80">
                {t('crm.salesChannels.summary.revenue', {
                  amount: totalAmount.toLocaleString(locale, {
                    maximumFractionDigits: 0,
                  }),
                })}{' '}
                €
              </span>
            </div>

            {/* Кнопка перехода к интеграциям */}
            <a
              href="/app/sales/integrations"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-xl border border-slate-700/80 text-[11px] text-slate-200 bg-slate-950/80 hover:bg-slate-900/80"
            >
              {t('crm.salesChannels.openIntegrations')}
              <span className="text-[10px]">↗</span>
            </a>
          </div>
        </section>

        {/* Диаграмма распределения выручки по каналам */}
        <section className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-100">
              {t('crm.salesChannels.chart.title')}
            </h2>
            <span className="text-[11px] text-slate-500">
              {t('crm.salesChannels.chart.hint')}
            </span>
          </div>

          {channels.length ? (
            <ChannelBarChart channels={channels} />
          ) : (
            <div className="text-[11px] text-slate-500 italic">
              {t('crm.salesChannels.chart.empty')}
            </div>
          )}
        </section>

        {/* Таблица каналов */}
        <section className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-100">
              {t('crm.salesChannels.table.title')}
            </h2>
            <span className="text-[11px] text-slate-500">
              {t('crm.salesChannels.table.hint')}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] md:text-xs border-separate border-spacing-y-1">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.salesChannels.table.headers.channel')}
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.salesChannels.table.headers.type')}
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.salesChannels.table.headers.integration')}
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.salesChannels.table.headers.apiKey')}
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.salesChannels.table.headers.connected')}
                  </th>
                  <th className="text-right font-normal px-2 py-1">
                    {t('crm.salesChannels.table.headers.sales')}
                  </th>
                  <th className="text-right font-normal px-2 py-1">
                    {t('crm.salesChannels.table.headers.amount')}
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.salesChannels.table.headers.status')}
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.salesChannels.table.headers.lastSync')}
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.salesChannels.table.headers.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {channels.map((ch) => (
                  <ChannelRow
                    key={ch.id}
                    channel={ch}
                    saving={savingId === ch.id}
                    onToggle={() => handleToggle(ch)}
                    onDelete={() => handleDelete(ch)}
                  />
                ))}

                {!channels.length && !loading && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-2 py-5 text-center text-[11px] text-slate-500 italic"
                    >
                      {t('crm.salesChannels.table.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {loading && (
          <div className="fixed inset-x-0 bottom-3 flex justify-center pointer-events-none">
            <div className="px-3 py-1.5 rounded-full bg-slate-950/95 border border-slate-700/80 text-[11px] text-slate-200 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-lumiva-accent animate-pulse" />
              {t('crm.salesChannels.loading')}
            </div>
          </div>
        )}

        {error && (
          <div className="fixed inset-x-0 bottom-3 flex justify-center pointer-events-none">
            <div className="px-3 py-1.5 rounded-full bg-red-950/95 border border-red-700/80 text-[11px] text-red-100">
              {error}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

/* ─────────────────────────────── */

const ChannelBarChart: React.FC<{ channels: SalesChannel[] }> = ({
  channels,
}) => {
  const { t } = useTranslation();
  const locale = getLocale();
  const top = [...channels]
    .filter((c) => c.totalSalesAmount > 0)
    .sort((a, b) => b.totalSalesAmount - a.totalSalesAmount)
    .slice(0, 8);

  if (!top.length) {
    return (
      <div className="text-[11px] text-slate-500 italic">
        {t('crm.salesChannels.chart.noRevenue')}
      </div>
    );
  }

  const max = Math.max(...top.map((c) => c.totalSalesAmount), 1);

  return (
    <div className="space-y-2 text-xs">
      {top.map((c) => {
        const width = Math.max(8, (c.totalSalesAmount / max) * 100);
        return (
          <div key={c.id} className="flex items-center gap-3">
            <div className="w-40 truncate text-slate-200">{c.name}</div>
            <div className="flex-1 h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-lumiva-accent-soft to-lumiva-accent"
                style={{ width: `${width}%` }}
              />
            </div>
            <div className="w-28 text-right text-slate-200">
              {c.totalSalesAmount.toLocaleString(locale, {
                maximumFractionDigits: 0,
              })}{' '}
              <span className="text-slate-400 text-[10px]">
                {c.currency}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ChannelRow: React.FC<{
  channel: SalesChannel;
  saving: boolean;
  onToggle: () => void;
  onDelete: () => void;
}> = ({ channel, saving, onToggle, onDelete }) => {
  const { t } = useTranslation();
  const locale = getLocale();
  const connectedAt = new Date(
    channel.connectedAt,
  ).toLocaleDateString(locale);

  const lastSync = channel.lastSyncAt
    ? new Date(channel.lastSyncAt).toLocaleString(locale)
    : t('crm.salesChannels.common.empty');

  const statusColor = channel.isEnabled
    ? 'bg-emerald-900/60 text-emerald-300'
    : 'bg-slate-800 text-slate-400';

  // Хвост API-ключа (если бэкенд его отдаёт, например "apiKeyTail": "1a2b3c")
  const apiKeyTail = (channel as any).apiKeyTail as string | undefined;
  const apiKeyLabel = apiKeyTail ? `*****${apiKeyTail}` : t('crm.salesChannels.common.empty');

  return (
    <tr className="bg-slate-950/80 hover:bg-slate-900/80 transition-colors">
      <td className="px-2 py-1.5 text-slate-100 whitespace-nowrap">
        {channel.name}
      </td>
      <td className="px-2 py-1.5 text-slate-300 whitespace-nowrap">
        {t(`crm.salesChannels.types.${channel.type}`)}
      </td>
      <td className="px-2 py-1.5 text-slate-300 whitespace-nowrap">
        {channel.integrationName ||
          channel.integrationId ||
          t('crm.salesChannels.common.empty')}
      </td>
      <td className="px-2 py-1.5 text-slate-300 whitespace-nowrap font-mono text-[10px]">
        {apiKeyLabel}
      </td>
      <td className="px-2 py-1.5 text-slate-300 whitespace-nowrap">
        {connectedAt}
      </td>
      <td className="px-2 py-1.5 text-right text-slate-200 whitespace-nowrap">
        {channel.totalSalesCount.toLocaleString(locale)}
      </td>
      <td className="px-2 py-1.5 text-right text-slate-200 whitespace-nowrap">
        {channel.totalSalesAmount.toLocaleString(locale, {
          maximumFractionDigits: 0,
        })}{' '}
        <span className="text-slate-400 text-[10px]">
          {channel.currency}
        </span>
      </td>
      <td className="px-2 py-1.5 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ${statusColor}`}
        >
          {channel.isEnabled
            ? t('crm.salesChannels.status.enabled')
            : t('crm.salesChannels.status.disabled')}
        </span>
      </td>
      <td className="px-2 py-1.5 text-slate-300 whitespace-nowrap">
        <div className="flex flex-col">
          <span>{lastSync}</span>
          {channel.lastError && (
            <span className="text-[10px] text-rose-300 truncate max-w-[220px]">
              {t('crm.salesChannels.lastError')} {channel.lastError}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5 whitespace-nowrap">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onToggle}
            disabled={saving}
            className="px-2 py-0.5 rounded-lg text-[10px] border border-slate-700/80 text-slate-200 bg-slate-950/80 hover:bg-slate-900/80 disabled:opacity-50"
          >
            {channel.isEnabled
              ? t('crm.salesChannels.actions.disable')
              : t('crm.salesChannels.actions.enable')}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="px-2 py-0.5 rounded-lg text-[10px] border border-rose-700/80 text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 disabled:opacity-50"
          >
            {t('crm.salesChannels.actions.delete')}
          </button>
        </div>
      </td>
    </tr>
  );
};
