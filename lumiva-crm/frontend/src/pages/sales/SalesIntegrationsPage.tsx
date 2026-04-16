// src/pages/sales/SalesIntegrationsPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { Link, useNavigate } from 'react-router-dom';
import {
  fetchIntegration,
  fetchIntegrations,
  updateIntegration,
  deleteIntegration,
  testIntegrationConnection,
  triggerIntegrationSync,
  type IntegrationConnectionDto,
} from './../../api/integrations';
import {
  fetchSalesChannels,
  type SalesChannel,
} from '../../api/salesChannels';
import { getLocale } from '../../i18n/utils';
import { integrationCatalogName } from '../automations/integrationsCatalog';

/* ─────────────────────────────── */
/* Вспомогательные маппинги       */
/* ─────────────────────────────── */

const LUMIVA_WP_CATALOG_IDS = new Set([
  'wordpress_cf7',
  'lumiva_client_cabinet',
  'lumiva_online_chat',
]);

/** Не показывать на странице «Интеграции продаж» — не импорт заказов / выручки. */
const THIRD_PARTY_NON_SALES_CATALOG_IDS = new Set([
  ...LUMIVA_WP_CATALOG_IDS,
  'google_sheets',
  'slack',
  'ms_teams',
  'google_calendar',
  'outlook',
  'whatsapp',
  'zapier',
  'google_ads',
  'meta_ads',
  'mailchimp',
  'openai',
  'jira',
]);

function isLumivaWpAddon(conn: IntegrationConnectionDto): boolean {
  return (
    conn.kind === 'third_party_link' &&
    Boolean(conn.linkCatalogId && LUMIVA_WP_CATALOG_IDS.has(conn.linkCatalogId))
  );
}

function isSalesRelatedIntegration(conn: IntegrationConnectionDto): boolean {
  if (conn.kind === 'woocommerce' || conn.kind === 'manual-import' || conn.kind === 'other') {
    return true;
  }
  if (conn.kind !== 'third_party_link') {
    return false;
  }
  const cid = conn.linkCatalogId || '';
  if (!cid) {
    return true;
  }
  return !THIRD_PARTY_NON_SALES_CATALOG_IDS.has(cid);
}

const actionBtnClass =
  'inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-[11px] font-medium border border-slate-500/45 text-slate-100 bg-slate-500/[0.08] hover:bg-slate-500/[0.14] disabled:opacity-50 transition-colors';
const actionBtnDangerClass =
  'inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-[11px] font-semibold border border-rose-500/40 bg-rose-200/45 text-rose-950 hover:bg-rose-200/65 hover:border-rose-600/45 disabled:opacity-50 transition-colors';

type WooEditFormState = {
  name: string;
  description: string;
  channelId: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
};

type ThirdPartyEditForm = {
  name: string;
  description: string;
  channelId: string;
  configJson: string;
};

const emptyTpForm: ThirdPartyEditForm = {
  name: '',
  description: '',
  channelId: '',
  configJson: '{}',
};

export const SalesIntegrationsPage: React.FC = () => {
  const { t } = useTranslation();
  const locale = getLocale();
  const navigate = useNavigate();
  const [connections, setConnections] = useState<IntegrationConnectionDto[]>([]);
  const [channels, setChannels] = useState<SalesChannel[]>([]);
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

  const kindLabels = useMemo(
    () => ({
      woocommerce: t('crm.salesIntegrations.kinds.woocommerce'),
      'manual-import': t('crm.salesIntegrations.kinds.manualImport'),
      other: t('crm.salesIntegrations.kinds.other'),
      third_party_link: t('crm.salesIntegrations.kinds.thirdPartyLink'),
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
  const [editMode, setEditMode] = useState<
    'woocommerce' | 'lumiva_simple' | 'third_party_config' | 'adapter_simple'
  >('woocommerce');
  const [editConn, setEditConn] = useState<IntegrationConnectionDto | null>(null);
  const [editForm, setEditForm] = useState<WooEditFormState>({
    name: '',
    description: '',
    channelId: '',
    url: '',
    consumerKey: '',
    consumerSecret: '',
  });
  const [tpForm, setTpForm] = useState<ThirdPartyEditForm>(emptyTpForm);
  const [editLoading, setEditLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const closeEditPanel = useCallback(() => {
    setEditOpen(false);
    setEditConn(null);
    setEditMode('woocommerce');
    setTpForm(emptyTpForm);
    setEditLoading(false);
  }, []);

  /* ─────────────────────────────── */
  /* Загрузка данных                 */
  /* ─────────────────────────────── */

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([fetchIntegrations(), fetchSalesChannels()])
      .then(([conns, ch]) => {
        if (!alive) return;
        setConnections(conns.filter((c: IntegrationConnectionDto) => !c.isDeleted));
        setChannels(ch.filter((c: SalesChannel) => !c.isDeleted));
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

  const salesConnections = useMemo(
    () => connections.filter(isSalesRelatedIntegration),
    [connections],
  );

  /* ─────────────────────────────── */
  /* Агрегаты                        */
  /* ─────────────────────────────── */

  const totalAmount = useMemo(
    () =>
      salesConnections.reduce(
        (s, c) => s + (c.totalSalesAmount || 0),
        0,
      ),
    [salesConnections],
  );

  const totalCount = useMemo(
    () =>
      salesConnections.reduce(
        (s, c) => s + (c.totalSalesCount || 0),
        0,
      ),
    [salesConnections],
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
    const syncKey = conn.lastSyncStatus || '';
    const statusBase =
      syncKey && syncKey in statusLabels
        ? statusLabels[syncKey as keyof typeof statusLabels]
        : conn.lastSyncStatus || t('crm.salesIntegrations.common.none');
    const statusColor =
      conn.lastSyncStatus === 'ok'
        ? 'border border-emerald-500/35 bg-emerald-200/40 text-emerald-950'
        : conn.lastSyncStatus === 'error'
          ? 'border border-rose-500/40 bg-rose-200/45 text-rose-950'
          : 'border border-slate-500/35 bg-slate-500/20 text-slate-100';
    const enabledColor = conn.isEnabled
      ? 'border border-emerald-500/35 bg-emerald-200/40 text-emerald-950'
      : 'border border-slate-500/35 bg-slate-500/20 text-slate-100';

    switch (columnId) {
      case 'connection': {
        const lumiva = isLumivaWpAddon(conn);
        const sub =
          conn.description?.trim() ||
          (lumiva && conn.linkCatalogId
            ? integrationCatalogName(conn.linkCatalogId, t)
            : '');
        return (
          <div className="flex flex-col">
            <span className="text-slate-100">{conn.name}</span>
            {sub ? (
              <span className="text-[10px] text-slate-500 truncate max-w-[220px]">
                {sub}
              </span>
            ) : null}
          </div>
        );
      }
      case 'type':
        return kindLabels[conn.kind];
      case 'channel':
        if (isLumivaWpAddon(conn)) return t('crm.salesIntegrations.common.empty');
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
              <span className="text-[10px] text-rose-900 truncate max-w-[220px]">
                {t('crm.salesIntegrations.list.lastError')} {conn.lastError}
              </span>
            )}
          </div>
        );
      case 'sales':
        if (isLumivaWpAddon(conn)) return t('crm.salesIntegrations.common.empty');
        return conn.totalSalesCount.toLocaleString(locale);
      case 'amount':
        if (isLumivaWpAddon(conn)) return t('crm.salesIntegrations.common.empty');
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
          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => void handleTest(conn)}
                disabled={testingId === conn.id || deletingId === conn.id}
                className={actionBtnClass}
              >
                {testingId === conn.id
                  ? t('crm.salesIntegrations.common.testing')
                  : t('crm.salesIntegrations.common.test')}
              </button>
              <button
                type="button"
                onClick={() => void handleSync(conn)}
                disabled={syncingId === conn.id || deletingId === conn.id}
                className={actionBtnClass}
              >
                {syncingId === conn.id
                  ? t('crm.salesIntegrations.common.syncing')
                  : t('crm.salesIntegrations.common.sync')}
              </button>
              <button
                type="button"
                onClick={() => void handleToggleEnabled(conn)}
                disabled={savingId === conn.id || deletingId === conn.id}
                className={actionBtnClass}
              >
                {conn.isEnabled
                  ? t('crm.salesIntegrations.common.disable')
                  : t('crm.salesIntegrations.common.enable')}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => void openEdit(conn)}
                disabled={deletingId === conn.id || editLoading}
                className={actionBtnClass}
              >
                {t('crm.salesIntegrations.common.edit')}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(conn)}
                disabled={deletingId === conn.id}
                className={actionBtnDangerClass}
              >
                {deletingId === conn.id
                  ? t('crm.salesIntegrations.common.deleting')
                  : t('crm.salesIntegrations.common.delete')}
              </button>
            </div>
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
  /* Редактирование подключения      */
  /* ─────────────────────────────── */

  const openEdit = async (conn: IntegrationConnectionDto) => {
    if (isLumivaWpAddon(conn)) {
      setEditMode('lumiva_simple');
      setEditConn(conn);
      setTpForm(emptyTpForm);
      setEditForm({
        name: conn.name || '',
        description: conn.description || '',
        channelId: '',
        url: '',
        consumerKey: '',
        consumerSecret: '',
      });
      setEditOpen(true);
      return;
    }

    setEditConn(conn);
    setEditOpen(true);
    setEditLoading(true);
    setTpForm(emptyTpForm);
    try {
      const full = await fetchIntegration(conn.id);
      setEditConn(full);

      if (full.kind === 'woocommerce') {
        setEditMode('woocommerce');
        const cfg: Record<string, unknown> =
          (full as IntegrationConnectionDto & { config?: Record<string, unknown> }).config ||
          {};
        setEditForm({
          name: full.name || '',
          description: full.description || '',
          channelId: full.channelId || '',
          url: typeof cfg.url === 'string' ? cfg.url : '',
          consumerKey: typeof cfg.consumerKey === 'string' ? cfg.consumerKey : '',
          consumerSecret:
            typeof cfg.consumerSecret === 'string' ? cfg.consumerSecret : '',
        });
        return;
      }

      if (full.kind === 'third_party_link') {
        setEditMode('third_party_config');
        setEditForm({
          name: full.name || '',
          description: full.description || '',
          channelId: full.channelId || '',
          url: '',
          consumerKey: '',
          consumerSecret: '',
        });
        const rawCfg =
          (full as IntegrationConnectionDto & { config?: Record<string, unknown> })
            .config || {};
        setTpForm({
          name: full.name || '',
          description: full.description || '',
          channelId: full.channelId || '',
          configJson: JSON.stringify(rawCfg, null, 2),
        });
        return;
      }

      setEditMode('adapter_simple');
      setEditForm({
        name: full.name || '',
        description: full.description || '',
        channelId: full.channelId || '',
        url: '',
        consumerKey: '',
        consumerSecret: '',
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(
        t('crm.salesIntegrations.errors.loadIntegrationFailed', {
          message: msg,
        }),
      );
      closeEditPanel();
    } finally {
      setEditLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editConn) return;

    if (editMode === 'lumiva_simple') {
      setUpdating(true);
      try {
        const updated = await updateIntegration(editConn.id, {
          name: editForm.name.trim() || editConn.name,
          description: editForm.description.trim()
            ? editForm.description.trim()
            : null,
        });
        setConnections((prev) =>
          prev.map((c) => (c.id === editConn.id ? updated : c)),
        );
        closeEditPanel();
      } catch (e: any) {
        console.error(e);
        alert(e.message || t('crm.salesIntegrations.errors.update'));
      } finally {
        setUpdating(false);
      }
      return;
    }

    if (editMode === 'adapter_simple') {
      setUpdating(true);
      try {
        const updated = await updateIntegration(editConn.id, {
          name: editForm.name.trim() || editConn.name,
          description: editForm.description.trim()
            ? editForm.description.trim()
            : null,
          channelId: editForm.channelId.trim() || null,
        });
        setConnections((prev) =>
          prev.map((c) => (c.id === editConn.id ? updated : c)),
        );
        closeEditPanel();
      } catch (e: any) {
        console.error(e);
        alert(e.message || t('crm.salesIntegrations.errors.update'));
      } finally {
        setUpdating(false);
      }
      return;
    }

    if (editMode === 'third_party_config') {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(tpForm.configJson) as Record<string, unknown>;
      } catch {
        alert(t('crm.salesIntegrations.errors.configJsonInvalid'));
        return;
      }
      setUpdating(true);
      try {
        const updated = await updateIntegration(editConn.id, {
          name: tpForm.name.trim() || editConn.name,
          description: tpForm.description.trim() ? tpForm.description.trim() : null,
          channelId: tpForm.channelId.trim() || null,
          config: parsed,
        });
        setConnections((prev) =>
          prev.map((c) => (c.id === editConn.id ? updated : c)),
        );
        closeEditPanel();
      } catch (e: any) {
        console.error(e);
        alert(e.message || t('crm.salesIntegrations.errors.update'));
      } finally {
        setUpdating(false);
      }
      return;
    }

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

      closeEditPanel();
    } catch (e: any) {
      console.error(e);
      alert(e.message || t('crm.salesIntegrations.errors.update'));
    } finally {
      setUpdating(false);
    }
  };

  /* ─────────────────────────────── */

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

        <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)]">
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5">
            <h2 className="text-sm font-semibold text-slate-100 mb-2">
              {t('crm.salesIntegrations.available.title')}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
              {t('crm.salesIntegrations.available.movedToHubBody')}
            </p>
            <Link
              to="/integrations-hub?woo=1"
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-lumiva-accent px-4 py-2 text-[11px] font-semibold text-slate-950 hover:bg-lumiva-accent-soft"
            >
              {t('crm.salesIntegrations.available.movedToHubButton')}
            </Link>
          </div>

          {/* Форма редактирования подключения */}
          {editOpen && editConn && (
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-100">
                  {editMode === 'lumiva_simple'
                    ? t('crm.salesIntegrations.edit.lumivaSimpleTitle')
                    : editMode === 'third_party_config'
                      ? t('crm.salesIntegrations.edit.thirdPartyTitle')
                      : t('crm.salesIntegrations.edit.title', {
                          name: editConn.name,
                        })}
                </h2>
                <button
                  type="button"
                  onClick={closeEditPanel}
                  className="text-[11px] text-slate-400 hover:text-slate-100"
                >
                  ✕ {t('crm.salesIntegrations.edit.close')}
                </button>
              </div>

              <div className="relative space-y-3 text-xs min-h-[120px]">
                {editLoading ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-950/70 backdrop-blur-[2px]">
                    <span className="text-[11px] text-slate-200">
                      {t('crm.salesIntegrations.edit.loadingDetails')}
                    </span>
                  </div>
                ) : null}

                {editMode === 'lumiva_simple' ? (
                  <>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {t('crm.salesIntegrations.edit.lumivaSimpleHint')}
                    </p>
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
                  </>
                ) : editMode === 'adapter_simple' ? (
                  <>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {t('crm.salesIntegrations.edit.adapterSimpleHint')}
                    </p>
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
                          setEditForm((f) => ({
                            ...f,
                            channelId: e.target.value,
                          }))
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
                  </>
                ) : editMode === 'third_party_config' ? (
                  <>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {t('crm.salesIntegrations.edit.thirdPartyHint')}
                    </p>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        {t('crm.salesIntegrations.edit.name')}
                      </label>
                      <input
                        type="text"
                        value={tpForm.name}
                        onChange={(e) =>
                          setTpForm((f) => ({ ...f, name: e.target.value }))
                        }
                        disabled={editLoading}
                        className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        {t('crm.salesIntegrations.edit.channel')}
                      </label>
                      <select
                        value={tpForm.channelId}
                        onChange={(e) =>
                          setTpForm((f) => ({ ...f, channelId: e.target.value }))
                        }
                        disabled={editLoading}
                        className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none disabled:opacity-50"
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
                        value={tpForm.description}
                        onChange={(e) =>
                          setTpForm((f) => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                        disabled={editLoading}
                        className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        {t('crm.salesIntegrations.edit.configJson')}
                      </label>
                      <textarea
                        value={tpForm.configJson}
                        onChange={(e) =>
                          setTpForm((f) => ({
                            ...f,
                            configJson: e.target.value,
                          }))
                        }
                        disabled={editLoading}
                        spellCheck={false}
                        rows={12}
                        className="w-full rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 py-2 outline-none font-mono leading-relaxed disabled:opacity-50"
                      />
                    </div>
                  </>
                ) : (
                  <>
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
                        disabled={editLoading}
                        className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        {t('crm.salesIntegrations.edit.channel')}
                      </label>
                      <select
                        value={editForm.channelId}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            channelId: e.target.value,
                          }))
                        }
                        disabled={editLoading}
                        className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none disabled:opacity-50"
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
                        disabled={editLoading}
                        className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none disabled:opacity-50"
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
                          disabled={editLoading}
                          className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none disabled:opacity-50"
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
                          disabled={editLoading}
                          className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none disabled:opacity-50"
                        />
                      </div>
                      <div className="md:col-span-2">
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
                          disabled={editLoading}
                          className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeEditPanel}
                    disabled={updating}
                    className="px-3 py-1.5 rounded-xl border border-slate-700/80 text-[11px] text-slate-200 bg-slate-950/80 hover:bg-slate-900/80 disabled:opacity-50"
                  >
                    {t('crm.salesIntegrations.common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleUpdate}
                    disabled={updating || editLoading}
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
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                {t('crm.salesIntegrations.list.title')}
              </h2>
              <p className="text-[10px] text-slate-500 mt-1 max-w-2xl leading-relaxed">
                {t('crm.salesIntegrations.list.filteredNote')}
              </p>
            </div>
            <span className="text-[11px] text-slate-500 shrink-0">
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
                {salesConnections.map((conn) => (
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

                {!salesConnections.length && !loading && (
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

