// src/pages/sales/SalesChannelsPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchSalesChannels,
  updateSalesChannel,
  deleteSalesChannel,
  type SalesChannel,
} from '../../api/salesChannels';
import { getLocale } from '../../i18n/utils';
import { useWorkspaceStyleColumnDrag } from '../../components/table/useWorkspaceStyleColumnDrag';
import { useAlertModal } from '../../contexts/AlertModalContext';

const actionBtnClass = 'btn-secondary btn-secondary-sm';
const actionBtnDangerClass = 'btn-danger btn-secondary-sm';

export const SalesChannelsPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
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
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizing, setResizing] = useState<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);

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

  const baseColumns = useMemo(
    () => [
      { id: 'channel', label: t('crm.salesChannels.table.headers.channel') },
      { id: 'type', label: t('crm.salesChannels.table.headers.type') },
      { id: 'integration', label: t('crm.salesChannels.table.headers.integration') },
      { id: 'apiKey', label: t('crm.salesChannels.table.headers.apiKey') },
      { id: 'connected', label: t('crm.salesChannels.table.headers.connected') },
      { id: 'sales', label: t('crm.salesChannels.table.headers.sales') },
      { id: 'amount', label: t('crm.salesChannels.table.headers.amount') },
      { id: 'status', label: t('crm.salesChannels.table.headers.status') },
      { id: 'lastSync', label: t('crm.salesChannels.table.headers.lastSync') },
      { id: 'actions', label: t('crm.salesChannels.table.headers.actions') },
    ],
    [t],
  );

  const orderedColumns = useMemo(() => {
    if (!baseColumns.length) return [];
    const map = new Map(baseColumns.map((col) => [col.id, col]));
    const order =
      columnOrder.length > 0 ? columnOrder : baseColumns.map((col) => col.id);
    const result: typeof baseColumns = [];
    order.forEach((id) => {
      const col = map.get(id);
      if (col) result.push(col);
    });
    baseColumns.forEach((col) => {
      if (!result.find((r) => r.id === col.id)) result.push(col);
    });
    return result;
  }, [baseColumns, columnOrder]);

  const getColumnWidth = (id: string, fallback: number) =>
    columnWidths[id] ?? fallback;

  useEffect(() => {
    try {
      const raw = localStorage.getItem('sales_channels_columns');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.order)) setColumnOrder(parsed.order);
        if (parsed.widths && typeof parsed.widths === 'object')
          setColumnWidths(parsed.widths);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'sales_channels_columns',
        JSON.stringify({ order: columnOrder, widths: columnWidths }),
      );
    } catch {
      // ignore
    }
  }, [columnOrder, columnWidths]);

  useEffect(() => {
    if (!baseColumns.length) return;
    setColumnOrder((prev) => {
      if (!prev.length) return baseColumns.map((c) => c.id);
      const ids = baseColumns.map((c) => c.id);
      const filtered = prev.filter((id) => ids.includes(id));
      const missing = ids.filter((id) => !filtered.includes(id));
      return [...filtered, ...missing];
    });
  }, [baseColumns]);

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e: MouseEvent) => {
      const delta = e.clientX - resizing.startX;
      const next = Math.max(90, resizing.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [resizing.id]: next }));
    };
    const handleUp = () => setResizing(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [resizing]);

  const startResize = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      id,
      startX: e.clientX,
      startWidth: columnWidths[id] ?? 160,
    });
  };

  const reorderColumns = useCallback((dragId: string, targetId: string) => {
    setColumnOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      return next;
    });
  }, []);

  const columnDrag = useWorkspaceStyleColumnDrag(reorderColumns, 'light');

  const renderCell = (ch: SalesChannel, columnId: string) => {
    switch (columnId) {
      case 'channel':
        return (
          <div className="flex flex-col">
            <span className="font-medium text-[#111827]">{ch.name}</span>
            {ch.description && (
              <span className="text-[10px] text-text-tertiary">{ch.description}</span>
            )}
          </div>
        );
      case 'type':
        return typeLabels[ch.type] || ch.type;
      case 'integration': {
        const label =
          ch.integrationName?.trim() || t('crm.salesChannels.common.empty');
        return (
          <div className="min-w-0 max-w-full">
            <span
              className="block truncate text-[#111827]"
              title={ch.integrationName?.trim() || undefined}
            >
              {label}
            </span>
          </div>
        );
      }
      case 'apiKey': {
        const key =
          ch.apiKeyMasked || ch.apiKeyTail || t('crm.salesChannels.common.empty');
        return (
          <span className="block truncate font-mono text-[10px]" title={String(key)}>
            {key}
          </span>
        );
      }
      case 'connected': {
        const connected =
          Boolean(ch.isConnected) || Boolean(ch.connectedAt);
        return connected
          ? t('crm.salesChannels.common.connected')
          : t('crm.salesChannels.common.disconnected');
      }
      case 'sales':
        return ch.totalSalesCount?.toLocaleString(locale) || '0';
      case 'amount':
        return (
          <>
            {(ch.totalSalesAmount || 0).toLocaleString(locale, {
              maximumFractionDigits: 0,
            })}{' '}
            €
          </>
        );
      case 'status':
        return ch.isEnabled
          ? t('crm.salesChannels.status.enabled')
          : t('crm.salesChannels.status.disabled');
      case 'lastSync':
        return ch.lastSyncAt
          ? new Date(ch.lastSyncAt).toLocaleString(locale)
          : t('crm.salesChannels.common.empty');
      case 'actions':
        return (
          <div className="flex flex-wrap items-center justify-end gap-1.5 min-w-[140px]">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggle(ch);
              }}
              className={actionBtnClass}
              disabled={savingId === ch.id}
            >
              {ch.isEnabled
                ? t('crm.salesChannels.actions.disable')
                : t('crm.salesChannels.actions.enable')}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(ch);
              }}
              className={actionBtnDangerClass}
              disabled={savingId === ch.id}
            >
              {t('crm.salesChannels.actions.delete')}
            </button>
          </div>
        );
      default:
        return null;
    }
  };

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
      showAlert(e.message || t('crm.salesChannels.errors.toggle'), {
        variant: 'error',
      });
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
      showAlert(e.message || t('crm.salesChannels.errors.delete'), {
        variant: 'error',
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        <section className="page-header">
          <div>
            <div className="section-label">{t('crm.salesChannels.kicker')}</div>
            <h1 className="page-title">{t('crm.salesChannels.title')}</h1>
            <p className="page-subtitle mt-1 max-w-2xl">{t('crm.salesChannels.subtitle')}</p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap gap-2 justify-end">
              <span className="badge bg-surface-subtle text-[#111827]">
                {t('crm.salesChannels.summary.channels', { count: channels.length })}
              </span>
              <span className="badge bg-surface-subtle text-[#111827]">
                {t('crm.salesChannels.summary.sales', { count: totalCount })}
              </span>
              <span className="badge bg-surface-subtle text-[#111827]">
                {t('crm.salesChannels.summary.revenue', {
                  amount: totalAmount.toLocaleString(locale, { maximumFractionDigits: 0 }),
                })}{' '}€
              </span>
            </div>
            <Link to="/app/sales/integrations" className="btn-secondary btn-secondary-sm">
              {t('crm.salesChannels.openIntegrations')}
              <span className="text-[10px]">↗</span>
            </Link>
          </div>
        </section>

        <section className="card p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#111827]">
              {t('crm.salesChannels.chart.title')}
            </h2>
            <span className="text-[11px] text-text-tertiary">
              {t('crm.salesChannels.chart.hint')}
            </span>
          </div>

          {channels.length ? (
            <ChannelBarChart channels={channels} />
          ) : (
            <div className="text-[11px] text-text-tertiary italic">
              {t('crm.salesChannels.chart.empty')}
            </div>
          )}
        </section>

        <section className="card p-4 md:p-5 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#111827]">
              {t('crm.salesChannels.table.title')}
            </h2>
            <span className="text-[11px] text-text-tertiary">
              {t('crm.salesChannels.table.hint')}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] md:text-xs border-separate border-spacing-y-1 table-fixed">
              <thead className="text-text-tertiary">
                <tr>
                  {orderedColumns.map((col) => {
                    const fallback =
                      col.id === 'channel'
                        ? 220
                        : col.id === 'type'
                          ? 140
                          : col.id === 'integration'
                            ? 180
                            : col.id === 'apiKey'
                              ? 180
                              : col.id === 'connected'
                                ? 140
                                : col.id === 'sales'
                                  ? 120
                                  : col.id === 'amount'
                                    ? 140
                                    : col.id === 'status'
                                      ? 120
                                      : col.id === 'lastSync'
                                        ? 170
                                        : 200;
                    const width = getColumnWidth(col.id, fallback);
                    return (
                      <th
                        key={col.id}
                        {...columnDrag.getThProps(
                          col.id,
                          typeof col.label === 'string' ? col.label : String(col.label),
                          'text-left font-normal px-2 py-1 relative group/colhdr select-none transition-colors duration-150',
                        )}
                        style={{ width, minWidth: width }}
                      >
                        <div className="flex min-h-[28px] items-center gap-2">
                          <span className="text-[10px] text-text-tertiary opacity-0 group-hover/colhdr:opacity-100 transition-opacity">
                            ⋮⋮
                          </span>
                          <span>{col.label}</span>
                        </div>
                        <div
                          data-col-resize
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover/colhdr:opacity-100"
                          onMouseDown={(e) => startResize(col.id, e)}
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {channels.map((ch) => (
                  <tr
                    key={ch.id}
                    className="bg-white hover:bg-surface-hover transition-colors"
                  >
                    {orderedColumns.map((col) => {
                      const fallback =
                        col.id === 'channel'
                          ? 220
                          : col.id === 'type'
                            ? 140
                            : col.id === 'integration'
                              ? 180
                              : col.id === 'apiKey'
                                ? 180
                                : col.id === 'connected'
                                  ? 140
                                  : col.id === 'sales'
                                    ? 120
                                    : col.id === 'amount'
                                      ? 140
                                      : col.id === 'status'
                                        ? 120
                                        : col.id === 'lastSync'
                                          ? 170
                                          : 200;
                      const width = getColumnWidth(col.id, fallback);
                      return (
                        <td
                          key={col.id}
                          className="px-2 py-1.5 text-[#111827] min-w-0 align-top"
                          style={{ width, minWidth: width }}
                        >
                          {renderCell(ch, col.id)}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {!channels.length && !loading && (
                  <tr>
                    <td
                      colSpan={orderedColumns.length}
                      className="px-2 py-5 text-center text-[11px] text-text-tertiary italic"
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
            <div className="px-3 py-1.5 rounded-full bg-white border border-border-default shadow-card-md text-[11px] text-text-secondary flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-lumiva-accent animate-pulse" />
              {t('crm.salesChannels.loading')}
            </div>
          </div>
        )}

        {error && (
          <div className="fixed inset-x-0 bottom-3 flex justify-center pointer-events-none">
            <div className="px-3 py-1.5 rounded-full bg-status-error-bg border border-red-200 text-[11px] text-status-error shadow-card">
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
      <div className="text-[11px] text-text-tertiary italic">
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
            <div className="w-40 truncate text-[#111827] font-medium">{c.name}</div>
            <div className="flex-1 h-1.5 bg-surface-active rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-lumiva-accent-soft to-lumiva-accent"
                style={{ width: `${width}%` }}
              />
            </div>
            <div className="w-28 text-right text-[#111827]">
              {c.totalSalesAmount.toLocaleString(locale, {
                maximumFractionDigits: 0,
              })}{' '}
              <span className="text-text-tertiary text-[10px]">
                {c.currency}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

