import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fetchIntegrationHubCatalog,
  fetchIntegrations,
  type IntegrationConnectionDto,
  type IntegrationHubCatalogEntry,
} from '../../api/integrations';
import { integrationCatalogName } from '../../pages/automations/integrationsCatalog';
import {
  type WorkspaceIntegrationBinding,
  updateWorkspaceArea,
  fetchWorkspaceArea,
  type WorkspaceArea,
  integrationMatchesWorkspaceCatalog,
  marketingProviderMatchesWorkspaceCatalog,
} from '../../api/workspaceAreas';
import {
  fetchMarketingIntegrations,
  type MarketingIntegrationRow,
} from '../../api/marketing';
import { fetchCustomObjects, type CustomObject } from '../../api/customObjects';
import { getWorkspaceTableKind } from '../../workspace/workspaceTableKind';
import { WorkspaceSourceIcon } from './WorkspaceSourceIcon';
function newId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type Props = {
  open: boolean;
  area: WorkspaceArea;
  onClose: () => void;
  onSaved: (next: WorkspaceArea) => void;
};

export const WorkspaceAreaIntegrationsModal: React.FC<Props> = ({
  open,
  area,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<IntegrationHubCatalogEntry[]>([]);
  const [connections, setConnections] = useState<IntegrationConnectionDto[]>([]);
  const [marketingRows, setMarketingRows] = useState<MarketingIntegrationRow[]>([]);
  const [bindings, setBindings] = useState<WorkspaceIntegrationBinding[]>([]);
  const [dataTables, setDataTables] = useState<CustomObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickKey, setPickKey] = useState('');
  const [pickConn, setPickConn] = useState('');
  const [pickTarget, setPickTarget] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSaveError(null);
    setLoading(true);
    Promise.all([
      fetchIntegrationHubCatalog(),
      fetchIntegrations(),
      fetchMarketingIntegrations().catch(() => [] as MarketingIntegrationRow[]),
      fetchCustomObjects(area.id).catch(() => [] as CustomObject[]),
    ])
      .then(([cat, conn, mkt, objs]) => {
        setCatalog(cat);
        setConnections(conn.filter((c) => !c.isDeleted && c.isEnabled));
        setMarketingRows(Array.isArray(mkt) ? mkt : []);
        setDataTables(objs.filter((o) => getWorkspaceTableKind(o.meta) === 'data'));
      })
      .finally(() => setLoading(false));
  }, [open, area.id]);

  useEffect(() => {
    if (!open) return;
    const raw = area.meta?.integrationBindings;
    if (!Array.isArray(raw)) {
      setBindings([]);
      return;
    }
    setBindings(
      raw.map((x: any) => ({
        id: String(x.id || newId()),
        catalogKey: String(x.catalogKey || ''),
        label: String(x.label || ''),
        connectionId: x.connectionId ?? null,
        marketingIntegrationId: x.marketingIntegrationId ?? null,
        targetObjectId: x.targetObjectId ?? null,
      })),
    );
  }, [open, area]);

  /** Типы, релевантные рабочей области: таблицы, продажи, маркетинг, календарь, лиды, почта */
  const workspaceFriendly = useMemo(
    () =>
      catalog.filter((c) => {
        const m = c.modules ?? [];
        return (
          m.includes('workspace') ||
          m.includes('sales') ||
          m.includes('marketing') ||
          m.includes('calendar') ||
          m.includes('leads') ||
          m.includes('email')
        );
      }),
    [catalog],
  );

  const connectionsForPick = useMemo(() => {
    if (!pickKey) return [];
    return connections.filter((c) => integrationMatchesWorkspaceCatalog(c, pickKey));
  }, [connections, pickKey]);

  const marketingForPick = useMemo(() => {
    if (!pickKey) return [];
    return marketingRows.filter(
      (m) => m.isActive && marketingProviderMatchesWorkspaceCatalog(m.provider, pickKey),
    );
  }, [marketingRows, pickKey]);

  useEffect(() => {
    if (!pickConn) return;
    const okHub = connectionsForPick.some((c) => c.id === pickConn);
    const okMkt =
      pickConn.startsWith('mkt:') &&
      marketingForPick.some((m) => `mkt:${m.id}` === pickConn);
    if (!okHub && !okMkt) {
      setPickConn('');
    }
  }, [connectionsForPick, marketingForPick, pickConn]);

  const makeBindingFromPick = (): WorkspaceIntegrationBinding | null => {
    if (!pickKey) return null;
    const fromMkt = pickConn.startsWith('mkt:');
    return {
      id: newId(),
      catalogKey: pickKey,
      label: integrationCatalogName(pickKey, t),
      connectionId: fromMkt ? null : pickConn || null,
      marketingIntegrationId: fromMkt ? pickConn.slice(4) : null,
      targetObjectId: pickTarget || null,
    };
  };

  const addBinding = () => {
    const row = makeBindingFromPick();
    if (!row) return;
    setBindings((prev) => [...prev, row]);
    setPickKey('');
    setPickConn('');
    setPickTarget('');
  };

  const removeBinding = (id: string) => {
    setBindings((prev) => prev.filter((b) => b.id !== id));
  };

  const setBindingTarget = (id: string, targetObjectId: string) => {
    setBindings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, targetObjectId: targetObjectId || null } : b)),
    );
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      let list = [...bindings];
      const pending = makeBindingFromPick();
      if (pending) {
        const isDup = list.some((b) => {
          if (b.catalogKey !== pending.catalogKey) return false;
          const sameConn =
            String(b.connectionId ?? '') === String(pending.connectionId ?? '');
          const sameMkt =
            String(b.marketingIntegrationId ?? '') ===
            String(pending.marketingIntegrationId ?? '');
          return sameConn && sameMkt;
        });
        if (!isDup) {
          list = [...list, pending];
        }
      }
      await updateWorkspaceArea(area.id, {
        meta: { integrationBindings: list },
      });
      const fresh = await fetchWorkspaceArea(area.id);
      onSaved(fresh);
      setPickKey('');
      setPickConn('');
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">
            {t('crm.workspace.area.integrations')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 p-4">
          <p className="text-sm text-slate-600">{t('crm.workspace.area.integrationsLead')}</p>
          <p className="text-[11px] leading-relaxed text-slate-500 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
            {t('crm.workspace.area.integrationsCatalogFooter')}{' '}
            <Link
              to="/app/email"
              className="font-medium text-lumiva-accent underline decoration-slate-200 underline-offset-2 hover:decoration-lumiva-accent"
            >
              {t('crm.workspace.area.integrationsEmailLink')}
            </Link>
          </p>
          {loading ? (
            <div className="text-sm text-slate-500">…</div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t('crm.workspace.area.bindingsTitle')}
                </div>
                {bindings.length === 0 && (
                  <div className="text-sm text-slate-500">{t('crm.workspace.area.bindingsEmpty')}</div>
                )}
                <ul className="space-y-2">
                  {bindings.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500">
                        <WorkspaceSourceIcon catalogKey={b.catalogKey} className="!h-[13px] !w-[13px]" />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{b.label}</span>
                      {dataTables.length > 0 && (
                        <select
                          value={b.targetObjectId || ''}
                          onChange={(e) => setBindingTarget(b.id, e.target.value)}
                          className="max-w-[160px] shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                          title={t('crm.workspace.area.bindingTargetTable')}
                        >
                          <option value="">{t('crm.workspace.area.bindingTargetNone')}</option>
                          {dataTables.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        className="shrink-0 text-rose-600 text-xs"
                        onClick={() => removeBinding(b.id)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-dashed border-slate-200 p-3 space-y-2">
                <div className="text-xs font-medium text-slate-600">{t('crm.workspace.area.addBinding')}</div>
                <select
                  value={pickKey}
                  onChange={(e) => setPickKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                >
                  <option value="">{t('crm.workspace.area.catalogPick')}</option>
                  {workspaceFriendly.map((c) => (
                    <option key={c.id} value={c.id}>
                      {integrationCatalogName(c.id, t)}
                    </option>
                  ))}
                </select>
                <select
                  value={pickConn}
                  onChange={(e) => setPickConn(e.target.value)}
                  disabled={!pickKey}
                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">
                    {!pickKey
                      ? t('crm.workspace.area.pickCatalogFirst')
                      : t('crm.workspace.area.connectionOptional')}
                  </option>
                  {connectionsForPick.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.kind}
                      {c.linkCatalogId ? ` · ${c.linkCatalogId}` : ''})
                    </option>
                  ))}
                  {marketingForPick.map((m) => (
                    <option key={`mkt-${m.id}`} value={`mkt:${m.id}`}>
                      {m.name} ({t('crm.workspace.area.connectionMarketingBadge')})
                    </option>
                  ))}
                </select>
                {pickKey &&
                  connectionsForPick.length === 0 &&
                  marketingForPick.length === 0 && (
                  <p className="text-xs leading-relaxed text-amber-800">
                    {t('crm.workspace.area.connectionPickEmpty')}
                  </p>
                )}
                {dataTables.length > 0 && (
                  <select
                    value={pickTarget}
                    onChange={(e) => setPickTarget(e.target.value)}
                    disabled={!pickKey}
                    className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">{t('crm.workspace.area.bindingTargetNone')}</option>
                    {dataTables.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={addBinding}
                  disabled={!pickKey}
                  className="w-full rounded-lg bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {t('crm.workspace.area.addBinding')}
                </button>
              </div>
            </>
          )}
          {saveError && (
            <p className="text-sm text-rose-600" role="alert">
              {saveError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              {t('crm.common.cancel')}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="rounded-xl bg-lumiva-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? '…' : t('crm.workspace.area.saveBindings')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
