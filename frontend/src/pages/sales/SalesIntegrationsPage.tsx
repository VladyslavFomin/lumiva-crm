// src/pages/sales/SalesIntegrationsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import {
  fetchIntegrations,
  fetchIntegrationAdapters,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  testIntegrationConnection,
  triggerIntegrationSync,
  type IntegrationConnectionDto,
  type IntegrationKind,
  type IntegrationAdapterDto,
} from './../../api/integrations';
import {
  fetchSalesChannels,
  type SalesChannel,
} from '../../api/salesChannels';
import { getLocale } from '../../i18n/utils';

/* ─────────────────────────────── */
/* Вспомогательные маппинги       */
/* ─────────────────────────────── */

/* ─────────────────────────────── */

type NewWooFormState = {
  name: string;
  description: string;
  channelId: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
};

export const SalesIntegrationsPage: React.FC = () => {
  const { t } = useTranslation();
  const locale = getLocale();
  const navigate = useNavigate();
  const [connections, setConnections] = useState<IntegrationConnectionDto[]>([]);
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [adapters, setAdapters] = useState<IntegrationAdapterDto[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [dragColumnId, setDragColumnId] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const [newOpen, setNewOpen] = useState(false);
  const [newKind] = useState<IntegrationKind>('woocommerce'); // only Woo for now
  const [newForm, setNewForm] = useState<NewWooFormState>({
    name: '',
    description: '',
    channelId: '',
    url: '',
    consumerKey: '',
    consumerSecret: '',
  });
  const [creating, setCreating] = useState(false);
  const kindLabels = useMemo(
    () => ({
      woocommerce: t('crm.salesIntegrations.kinds.woocommerce'),
      'manual-import': t('crm.salesIntegrations.kinds.manualImport'),
      other: t('crm.salesIntegrations.kinds.other'),
    }),
    [t],
  );
  const statusLabels = useMemo(
    () => ({
      never: t('crm.salesIntegrations.status.never'),
      ok: t('crm.salesIntegrations.status.ok'),
      error: t('crm.salesIntegrations.status.error'),
    }),
    [t],
  );

  const baseColumns = useMemo(
    () => [
      { id: 'connection', label: t('crm.salesIntegrations.list.headers.connection') },
      { id: 'type', label: t('crm.salesIntegrations.list.headers.type') },
      { id: 'channel', label: t('crm.salesIntegrations.list.headers.channel') },
      { id: 'status', label: t('crm.salesIntegrations.list.headers.status') },
      { id: 'lastSync', label: t('crm.salesIntegrations.list.headers.lastSync') },
      { id: 'sales', label: t('crm.salesIntegrations.list.headers.sales') },
      { id: 'amount', label: t('crm.salesIntegrations.list.headers.amount') },
      { id: 'actions', label: t('crm.salesIntegrations.list.headers.actions') },
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

  // ─── Редактирование интеграции ────────────────────────────

  const [editOpen, setEditOpen] = useState(false);
  const [editConn, setEditConn] = useState<IntegrationConnectionDto | null>(null);
  const [editForm, setEditForm] = useState<NewWooFormState>({
    name: '',
    description: '',
    channelId: '',
    url: '',
    consumerKey: '',
    consumerSecret: '',
  });
  const [updating, setUpdating] = useState(false);

  /* ─────────────────────────────── */
  /* Загрузка данных                 */
  /* ─────────────────────────────── */

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchIntegrations(),
      fetchSalesChannels(),
      fetchIntegrationAdapters(),
    ])
      .then(([conns, ch, ad]) => {
        if (!alive) return;
        setConnections(conns.filter((c: IntegrationConnectionDto) => !c.isDeleted));
        setChannels(ch.filter((c: SalesChannel) => !c.isDeleted));
        setAdapters(ad);
      })
      .catch((e: any) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.salesIntegrations.errors.load'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('sales_integrations_columns');
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
        'sales_integrations_columns',
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

  /* ─────────────────────────────── */
  /* Агрегаты                        */
  /* ─────────────────────────────── */

  const totalAmount = useMemo(
    () =>
      connections.reduce(
        (s, c) => s + (c.totalSalesAmount || 0),
        0,
      ),
    [connections],
  );

  const totalCount = useMemo(
    () =>
      connections.reduce(
        (s, c) => s + (c.totalSalesCount || 0),
        0,
      ),
    [connections],
  );

  /* ─────────────────────────────── */
  /* Хелперы                         */
  /* ─────────────────────────────── */

  const findChannelName = (channelId: string | null): string => {
    if (!channelId) return t('crm.salesIntegrations.common.empty');
    const ch = channels.find((c: SalesChannel) => c.id === channelId);
    return ch?.name || t('crm.salesIntegrations.common.empty');
  };

  const startResize = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      id,
      startX: e.clientX,
      startWidth: columnWidths[id] ?? 160,
    });
  };

  const handleColumnDrop = (targetId: string) => {
    if (!dragColumnId || dragColumnId === targetId) return;
    setColumnOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragColumnId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragColumnId);
      return next;
    });
    setDragColumnId(null);
  };

  const renderCell = (
    conn: IntegrationConnectionDto,
    columnId: string,
  ) => {
    const channelName = findChannelName(conn.channelId);
    const lastSync =
      conn.lastSyncAt && conn.lastSyncAt !== null
        ? new Date(conn.lastSyncAt).toLocaleString(locale)
        : t('crm.salesIntegrations.common.none');
    const statusBase =
      conn.lastSyncStatus && statusLabels[conn.lastSyncStatus]
        ? statusLabels[conn.lastSyncStatus]
        : conn.lastSyncStatus || t('crm.salesIntegrations.common.none');
    const statusColor =
      conn.lastSyncStatus === 'ok'
        ? 'bg-emerald-900/60 text-emerald-300'
        : conn.lastSyncStatus === 'error'
          ? 'bg-rose-900/60 text-rose-300'
          : 'bg-slate-800 text-slate-300';
    const enabledColor = conn.isEnabled
      ? 'bg-emerald-900/60 text-emerald-300'
      : 'bg-slate-800 text-slate-400';

    switch (columnId) {
      case 'connection':
        return (
          <div className="flex flex-col">
            <span className="text-slate-100">{conn.name}</span>
            {conn.description && (
              <span className="text-[10px] text-slate-500 truncate max-w-[220px]">
                {conn.description}
              </span>
            )}
          </div>
        );
      case 'type':
        return kindLabels[conn.kind];
      case 'channel':
        return channelName;
      case 'status':
        return (
          <div className="flex flex-col gap-0.5">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ${enabledColor}`}
            >
              {conn.isEnabled
                ? t('crm.salesIntegrations.status.enabled')
                : t('crm.salesIntegrations.status.disabled')}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ${statusColor}`}
            >
              {statusBase}
            </span>
          </div>
        );
      case 'lastSync':
        return (
          <div className="flex flex-col">
            <span>{lastSync}</span>
            {conn.lastError && (
              <span className="text-[10px] text-rose-300 truncate max-w-[220px]">
                {t('crm.salesIntegrations.list.lastError')} {conn.lastError}
              </span>
            )}
          </div>
        );
      case 'sales':
        return conn.totalSalesCount.toLocaleString(locale);
      case 'amount':
        return (
          <>
            {conn.totalSalesAmount.toLocaleString(locale, {
              maximumFractionDigits: 0,
            })}{' '}
            <span className="text-slate-400 text-[10px]">
              {conn.currency}
            </span>
          </>
        );
      case 'actions':
        return (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => handleTest(conn)}
              disabled={testingId === conn.id || deletingId === conn.id}
              className="px-2 py-0.5 rounded-lg text-[10px] border border-slate-700/80 text-slate-200 bg-slate-950/80 hover:bg-slate-900/80 disabled:opacity-50"
            >
              {testingId === conn.id
                ? t('crm.salesIntegrations.common.testing')
                : t('crm.salesIntegrations.common.test')}
            </button>
            <button
              type="button"
              onClick={() => handleSync(conn)}
              disabled={syncingId === conn.id || deletingId === conn.id}
              className="px-2 py-0.5 rounded-lg text-[10px] border border-slate-700/80 text-slate-200 bg-slate-950/80 hover:bg-slate-900/80 disabled:opacity-50"
            >
              {syncingId === conn.id
                ? t('crm.salesIntegrations.common.syncing')
                : t('crm.salesIntegrations.common.sync')}
            </button>
            <button
              type="button"
              onClick={() => handleToggleEnabled(conn)}
              disabled={savingId === conn.id || deletingId === conn.id}
              className="px-2 py-0.5 rounded-lg text-[10px] border border-slate-700/80 text-slate-200 bg-slate-950/80 hover:bg-slate-900/80 disabled:opacity-50"
            >
              {conn.isEnabled
                ? t('crm.salesIntegrations.common.disable')
                : t('crm.salesIntegrations.common.enable')}
            </button>
            <button
              type="button"
              onClick={() => openEdit(conn)}
              disabled={deletingId === conn.id}
              className="px-2 py-0.5 rounded-lg text-[10px] border border-slate-700/80 text-slate-200 bg-slate-950/80 hover:bg-slate-900/80 disabled:opacity-50"
            >
              {t('crm.salesIntegrations.common.edit')}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(conn)}
              disabled={deletingId === conn.id}
              className="px-2 py-0.5 rounded-lg text-[10px] border border-rose-700/80 text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 disabled:opacity-50"
            >
              {deletingId === conn.id
                ? t('crm.salesIntegrations.common.deleting')
                : t('crm.salesIntegrations.common.delete')}
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  const handleToggleEnabled = async (conn: IntegrationConnectionDto) => {
    setSavingId(conn.id);
    try {
      const updated = await updateIntegration(conn.id, {
        isEnabled: !conn.isEnabled,
      });
      setConnections((prev) =>
        prev.map((c) => (c.id === conn.id ? updated : c)),
      );
    } catch (e: any) {
      console.error(e);
      alert(e.message || t('crm.salesIntegrations.errors.toggle'));
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (conn: IntegrationConnectionDto) => {
    if (
      !window.confirm(
        t('crm.salesIntegrations.deleteConfirm', { name: conn.name }),
      )
    ) {
      return;
    }
    setDeletingId(conn.id);
    try {
      await deleteIntegration(conn.id);
      setConnections((prev) =>
        prev.filter((c) => c.id !== conn.id),
      );
    } catch (e: any) {
      console.error(e);
      alert(e.message || t('crm.salesIntegrations.errors.delete'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleTest = async (conn: IntegrationConnectionDto) => {
    setTestingId(conn.id);
    try {
      const res = await testIntegrationConnection(conn.id);
      alert(
        res.ok
          ? t('crm.salesIntegrations.test.ok', {
              message: res.message || 'OK',
            })
          : t('crm.salesIntegrations.test.fail', {
              message:
                res.message || t('crm.salesIntegrations.test.defaultError'),
            }),
      );
    } catch (e: any) {
      console.error(e);
      alert(e.message || t('crm.salesIntegrations.errors.test'));
    } finally {
      setTestingId(null);
    }
  };

  const handleSync = async (conn: IntegrationConnectionDto) => {
    setSyncingId(conn.id);
    try {
      const res = await triggerIntegrationSync(conn.id);
      const msg =
        res.message ||
        t('crm.salesIntegrations.sync.summary', {
          created: res.created,
          updated: res.updated,
          skipped: res.skipped,
        });
      alert(t('crm.salesIntegrations.sync.done', { message: msg }));

      // После синка можно обновить список (чтобы подтянуть новые totalSales*)
      const updated = await fetchIntegrations();
      setConnections(
        updated.filter((c: IntegrationConnectionDto) => !c.isDeleted),
      );
    } catch (e: any) {
      console.error(e);
      alert(e.message || t('crm.salesIntegrations.errors.sync'));
    } finally {
      setSyncingId(null);
    }
  };

  /* ─────────────────────────────── */
  /* Новое подключение WooCommerce   */
  /* ─────────────────────────────── */

  const handleCreate = async () => {
    if (!newForm.url || !newForm.consumerKey || !newForm.consumerSecret) {
      alert(t('crm.salesIntegrations.errors.createMissing'));
      return;
    }

    setCreating(true);
    try {
      const payload = {
        name:
          newForm.name ||
          t('crm.salesIntegrations.defaults.woocommerceName'),
        kind: newKind,
        channelId: newForm.channelId || undefined,
        description: newForm.description || undefined,
        config: {
          url: newForm.url.trim(),
          consumerKey: newForm.consumerKey.trim(),
          consumerSecret: newForm.consumerSecret.trim(),
        },
      };

      const created = await createIntegration(payload);
      setConnections((prev) => [created, ...prev]);
      setNewOpen(false);
      setNewForm({
        name: '',
        description: '',
        channelId: '',
        url: '',
        consumerKey: '',
        consumerSecret: '',
      });
    } catch (e: any) {
      console.error(e);
      alert(e.message || t('crm.salesIntegrations.errors.create'));
    } finally {
      setCreating(false);
    }
  };

  /* ─────────────────────────────── */
  /* Редактирование подключения      */
  /* ─────────────────────────────── */

  const openEdit = (conn: IntegrationConnectionDto) => {
    const cfg: any = (conn as any).config || {};

    setEditConn(conn);
    setEditForm({
      name: conn.name || '',
      description: conn.description || '',
      channelId: conn.channelId || '',
      url: cfg.url || '',
      consumerKey: cfg.consumerKey || '',
      consumerSecret: '',
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editConn) return;

    if (!editForm.url || !editForm.consumerKey) {
      alert(t('crm.salesIntegrations.errors.updateMissing'));
      return;
    }

    setUpdating(true);
    try {
      const payload: any = {
        name:
          editForm.name ||
          t('crm.salesIntegrations.defaults.woocommerceName'),
        channelId: editForm.channelId || null,
        description: editForm.description || null,
        config: {
          url: editForm.url.trim(),
          consumerKey: editForm.consumerKey.trim(),
        },
      };

      if (editForm.consumerSecret.trim()) {
        payload.config.consumerSecret = editForm.consumerSecret.trim();
      }

      const updated = await updateIntegration(editConn.id, payload);

      setConnections(prev =>
        prev.map(c => (c.id === editConn.id ? updated : c)),
      );

      setEditOpen(false);
      setEditConn(null);
    } catch (e: any) {
      console.error(e);
      alert(e.message || t('crm.salesIntegrations.errors.update'));
    } finally {
      setUpdating(false);
    }
  };

  /* ─────────────────────────────── */

  const availableWoo = adapters.find((a) => a.kind === 'woocommerce');

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        {/* Заголовок */}
        <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              {t('crm.salesIntegrations.kicker')}
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              {t('crm.salesIntegrations.title')}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {t('crm.salesIntegrations.subtitle')}
            </p>
          </div>
        </section>

        {/* Карточки типов интеграций + кнопка "Новое подключение" */}
        <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)]">
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5">
            <h2 className="text-sm font-semibold text-slate-100 mb-2">
              {t('crm.salesIntegrations.available.title')}
            </h2>

            {availableWoo ? (
              <div className="flex flex-col gap-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-slate-100 font-semibold">
                      {kindLabels.woocommerce}
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      {t('crm.salesIntegrations.available.woocommerceHint')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewOpen(true);
                      setEditOpen(false);
                      setEditConn(null);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-lumiva-accent text-slate-950 text-[11px] font-semibold hover:bg-lumiva-accent-soft"
                  >
                    {t('crm.salesIntegrations.available.newConnection')}
                  </button>
                </div>
                <div className="text-[11px] text-slate-500">
                  {t('crm.salesIntegrations.available.woocommerceNote')}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500">
                {t('crm.salesIntegrations.available.empty')}
              </div>
            )}
          </div>

          {/* Форма нового подключения */}
          {newOpen && (
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-100">
                  {t('crm.salesIntegrations.new.title')}
                </h2>
                <button
                  type="button"
                  onClick={() => setNewOpen(false)}
                  className="text-[11px] text-slate-400 hover:text-slate-100"
                >
                  ✕ {t('crm.salesIntegrations.new.close')}
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {t('crm.salesIntegrations.new.name')}
                  </label>
                  <input
                    type="text"
                    value={newForm.name}
                    onChange={(e) =>
                      setNewForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder={t('crm.salesIntegrations.new.namePlaceholder')}
                    className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {t('crm.salesIntegrations.new.channel')}
                  </label>
                  <select
                    value={newForm.channelId}
                    onChange={(e) =>
                      setNewForm((f) => ({ ...f, channelId: e.target.value }))
                    }
                    className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                  >
                    <option value="">{t('crm.salesIntegrations.new.channelAuto')}</option>
                    {channels.map((ch: SalesChannel) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {t('crm.salesIntegrations.new.description')}
                  </label>
                  <input
                    type="text"
                    value={newForm.description}
                    onChange={(e) =>
                      setNewForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                    placeholder={t('crm.salesIntegrations.new.descriptionPlaceholder')}
                    className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('crm.salesIntegrations.new.url')}
                    </label>
                    <input
                      type="text"
                      value={newForm.url}
                      onChange={(e) =>
                        setNewForm((f) => ({ ...f, url: e.target.value }))
                      }
                      placeholder={t('crm.salesIntegrations.new.urlPlaceholder')}
                      className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('crm.salesIntegrations.new.consumerKey')}
                    </label>
                    <input
                      type="text"
                      value={newForm.consumerKey}
                      onChange={(e) =>
                        setNewForm((f) => ({
                          ...f,
                          consumerKey: e.target.value,
                        }))
                      }
                      placeholder="ck_..."
                      className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('crm.salesIntegrations.new.consumerSecret')}
                    </label>
                    <input
                      type="text"
                      value={newForm.consumerSecret}
                      onChange={(e) =>
                        setNewForm((f) => ({
                          ...f,
                          consumerSecret: e.target.value,
                        }))
                      }
                      placeholder="cs_..."
                      className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setNewOpen(false)}
                    disabled={creating}
                    className="px-3 py-1.5 rounded-xl border border-slate-700/80 text-[11px] text-slate-200 bg-slate-950/80 hover:bg-slate-900/80 disabled:opacity-50"
                  >
                    {t('crm.salesIntegrations.common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={creating}
                    className="px-4 py-1.5 rounded-xl bg-lumiva-accent text-slate-950 text-[11px] font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
                  >
                    {creating
                      ? t('crm.salesIntegrations.common.creating')
                      : t('crm.salesIntegrations.common.create')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Форма редактирования подключения */}
          {editOpen && editConn && (
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-100">
                  {t('crm.salesIntegrations.edit.title', {
                    name: editConn.name,
                  })}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setEditOpen(false);
                    setEditConn(null);
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-100"
                >
                  ✕ {t('crm.salesIntegrations.edit.close')}
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {t('crm.salesIntegrations.edit.name')}
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {t('crm.salesIntegrations.edit.channel')}
                  </label>
                  <select
                    value={editForm.channelId}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, channelId: e.target.value }))
                    }
                    className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                  >
                    <option value="">
                      {t('crm.salesIntegrations.edit.channelAuto')}
                    </option>
                    {channels.map((ch: SalesChannel) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {t('crm.salesIntegrations.edit.description')}
                  </label>
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                    className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('crm.salesIntegrations.edit.url')}
                    </label>
                    <input
                      type="text"
                      value={editForm.url}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, url: e.target.value }))
                      }
                      className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('crm.salesIntegrations.edit.consumerKey')}
                    </label>
                    <input
                      type="text"
                      value={editForm.consumerKey}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          consumerKey: e.target.value,
                        }))
                      }
                      className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('crm.salesIntegrations.edit.consumerSecret')}
                    </label>
                    <input
                      type="text"
                      value={editForm.consumerSecret}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          consumerSecret: e.target.value,
                        }))
                      }
                      placeholder="cs_..."
                      className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditOpen(false);
                      setEditConn(null);
                    }}
                    disabled={updating}
                    className="px-3 py-1.5 rounded-xl border border-slate-700/80 text-[11px] text-slate-200 bg-slate-950/80 hover:bg-slate-900/80 disabled:opacity-50"
                  >
                    {t('crm.salesIntegrations.common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleUpdate}
                    disabled={updating}
                    className="px-4 py-1.5 rounded-xl bg-lumiva-accent text-slate-950 text-[11px] font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
                  >
                    {updating
                      ? t('crm.salesIntegrations.common.saving')
                      : t('crm.salesIntegrations.common.save')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Таблица интеграций */}
        <section className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-100">
              {t('crm.salesIntegrations.list.title')}
            </h2>
            <span className="text-[11px] text-slate-500">
              {t('crm.salesIntegrations.list.subtitle')}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] md:text-xs border-separate border-spacing-y-1 table-fixed">
              <thead className="text-slate-500">
                <tr>
                  {orderedColumns.map((col) => {
                    const fallback =
                      col.id === 'connection'
                        ? 220
                        : col.id === 'type'
                          ? 140
                          : col.id === 'channel'
                            ? 180
                            : col.id === 'status'
                              ? 170
                              : col.id === 'lastSync'
                                ? 200
                                : col.id === 'sales'
                                  ? 120
                                  : col.id === 'amount'
                                    ? 140
                                    : 240;
                    const width = getColumnWidth(col.id, fallback);
                    return (
                      <th
                        key={col.id}
                        draggable
                        onDragStart={(e) => {
                          setDragColumnId(col.id);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', col.id);
                        }}
                        onDragEnd={() => setDragColumnId(null)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleColumnDrop(col.id)}
                        className="text-left font-normal px-2 py-1 relative group"
                        style={{ width, minWidth: width }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="cursor-move">⋮⋮</span>
                          <span>{col.label}</span>
                        </div>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100"
                          onMouseDown={(e) => startResize(col.id, e)}
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {connections.map((conn) => (
                  <tr
                    key={conn.id}
                    className="bg-slate-950/80 hover:bg-slate-900/80 transition-colors"
                  >
                    {orderedColumns.map((col) => {
                      const fallback =
                        col.id === 'connection'
                          ? 220
                          : col.id === 'type'
                            ? 140
                            : col.id === 'channel'
                              ? 180
                              : col.id === 'status'
                                ? 170
                                : col.id === 'lastSync'
                                  ? 200
                                  : col.id === 'sales'
                                    ? 120
                                    : col.id === 'amount'
                                      ? 140
                                      : 240;
                      const width = getColumnWidth(col.id, fallback);
                      return (
                        <td
                          key={col.id}
                          className="px-2 py-1.5 text-slate-300"
                          style={{ width, minWidth: width }}
                        >
                          {renderCell(conn, col.id)}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {!connections.length && !loading && (
                  <tr>
                    <td
                      colSpan={orderedColumns.length}
                      className="px-2 py-5 text-center text-[11px] text-slate-500 italic"
                    >
                      {t('crm.salesIntegrations.list.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {loading && (
            <div className="mt-3 text-[11px] text-slate-400">
              {t('crm.salesIntegrations.loading')}
            </div>
          )}
        </section>

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

