import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import './WorkspaceArea.css';
import { WsAreaBar } from '../../components/workspace/WsAreaBar';
import {
  fetchCustomObjects,
  fetchCustomObjectFields,
  fetchAllCustomObjectRecords,
  fetchCustomObjectRecordsPage,
  type CustomObject,
  type CustomObjectField,
} from '../../api/customObjects';
import {
  fetchWorkspaceArea,
  readWorkspaceIntegrationBindings,
  fetchWorkspaceAreaMembers,
  fetchWorkspaceAreaActivityLog,
  workspaceBindingHasActiveIntegration,
  type WorkspaceArea,
  type WorkspaceAreaActivityLogEntryDto,
  type WorkspaceIntegrationBinding,
} from '../../api/workspaceAreas';
import { fetchIntegrations, type IntegrationConnectionDto } from '../../api/integrations';
import { fetchMarketingIntegrations, type MarketingIntegrationRow } from '../../api/marketing';
import type { WorkspaceAreaMember } from '../../workspace/workspaceAreaRole';
import { WorkspaceAreaIntegrationsModal } from '../../components/workspace/WorkspaceAreaIntegrationsModal';
import { PushToBoardModal } from '../../components/workspace/PushToBoardModal';
import { NAV_ICON_MAP, NavIconPlus, type NavIconKey } from '../../components/layout/NavSidebarIcons';
import { parseEnabledViews } from '../../workspace/workspaceEnabledViews';
import { readRecentWorkspaceTables, touchRecentWorkspaceTable } from '../../workspace/workspaceRecentTables';
import { getWorkspaceTableKind } from '../../workspace/workspaceTableKind';
import { WORKSPACE_LINKED_DATA_OBJECT_IDS_KEY, getWorkspaceDataLink } from '../../workspace/workspaceRecordLink';
import {
  parseWorkspaceColumnBindingV1,
  type WorkspaceColumnBindingV1,
} from '../../workspace/workspaceColumnBinding';
import { WorkspaceSourceIcon as SourceIcon } from '../../components/workspace/WorkspaceSourceIcon';

type TabKey = 'recent' | 'content' | 'sources' | 'bindings' | 'log';

function initials(name: string | undefined | null, fallback: string): string {
  const n = (name || '').trim();
  if (!n) return (fallback || '?').slice(0, 1).toUpperCase();
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

function linkedDataIds(o: CustomObject): string[] {
  const raw = o.meta?.[WORKSPACE_LINKED_DATA_OBJECT_IDS_KEY];
  return Array.isArray(raw) ? raw.map((x) => String(x)).filter((id) => /^[0-9a-f-]{36}$/i.test(id)) : [];
}

type BindRow = {
  tableId: string;
  tableName: string;
  fieldKey: string;
  fieldLabel: string;
  mode: string;
  summary: string;
};

function bindingSummary(b: WorkspaceColumnBindingV1, nameOf: (id: string) => string): string {
  switch (b.mode) {
    case 'from_pushed_source':
      return b.sourceFieldKey;
    case 'lookup_by_key':
      return `${nameOf(b.dataObjectId)}: ${b.dataMatchFieldKey} = ${b.boardMatchFieldKey} → ${b.dataDisplayFieldKey}`;
    case 'pick_from_data':
      return `${nameOf(b.dataObjectId)}.${b.dataFieldKey}`;
    case 'cached_snapshot':
      return b.sourceLabel || '—';
    case 'rollup':
      return `${nameOf(b.dataObjectId)}: ${b.aggregate}(${b.valueFieldKey}) / ${b.groupByFieldKey}`;
    default:
      return '—';
  }
}

const LOG_GLYPH: Record<string, string> = {
  sync: '⟳',
  import: '⇩',
  push: '↑',
  mapping_change: '⚙',
  table_created: '+',
  error: '!',
};

export const WorkspaceAreaHomePage: React.FC = () => {
  const { t } = useTranslation();
  const { areaId = '' } = useParams();
  const navigate = useNavigate();

  const [area, setArea] = useState<WorkspaceArea | null>(null);
  const [objects, setObjects] = useState<CustomObject[]>([]);
  const [members, setMembers] = useState<WorkspaceAreaMember[]>([]);
  const [connections, setConnections] = useState<IntegrationConnectionDto[]>([]);
  const [marketingRows, setMarketingRows] = useState<MarketingIntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('recent');
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [dataRecordCounts, setDataRecordCounts] = useState<Record<string, number>>({});
  /** dataObjectId -> { count, boardName } — сколько строк из этой таблицы данных уже передано и куда. */
  const [pushedCounts, setPushedCounts] = useState<Record<string, { count: number; boardName: string }>>({});
  const [pushLoadingId, setPushLoadingId] = useState<string | null>(null);
  const [downloadLoadingId, setDownloadLoadingId] = useState<string | null>(null);
  const [pushState, setPushState] = useState<{
    sourceObjectId: string;
    recordIds: string[];
    sourceFields: CustomObjectField[];
  } | null>(null);
  const [logEntries, setLogEntries] = useState<WorkspaceAreaActivityLogEntryDto[] | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [bindRows, setBindRows] = useState<BindRow[] | null>(null);
  const [bindLoading, setBindLoading] = useState(false);

  const load = useCallback(async () => {
    if (!areaId || !/^[0-9a-f-]{36}$/i.test(areaId)) return;
    setLoading(true);
    try {
      const [a, obs, mem, conn, mkt] = await Promise.all([
        fetchWorkspaceArea(areaId),
        fetchCustomObjects(areaId),
        fetchWorkspaceAreaMembers(areaId).catch(() => [] as WorkspaceAreaMember[]),
        fetchIntegrations().catch(() => [] as IntegrationConnectionDto[]),
        fetchMarketingIntegrations().catch(() => [] as MarketingIntegrationRow[]),
      ]);
      setArea(a);
      setObjects(obs);
      setMembers(mem);
      setConnections(conn.filter((c) => !c.isDeleted && c.isEnabled));
      setMarketingRows(Array.isArray(mkt) ? mkt : []);

      const dataObjs = obs.filter((o) => getWorkspaceTableKind(o.meta) === 'data');
      void Promise.all(
        dataObjs.map((o) =>
          fetchCustomObjectRecordsPage(o.id, { limit: 1 })
            .then((r) => [o.id, r.total] as const)
            .catch(() => [o.id, 0] as const),
        ),
      ).then((pairs) => setDataRecordCounts(Object.fromEntries(pairs)));

      const boardObjs = obs.filter((o) => getWorkspaceTableKind(o.meta) === 'board');
      void Promise.all(
        boardObjs.map((board) =>
          fetchAllCustomObjectRecords(board.id)
            .then((records) => ({ board, records }))
            .catch(() => ({ board, records: [] as Awaited<ReturnType<typeof fetchAllCustomObjectRecords>> })),
        ),
      ).then((results) => {
        const next: Record<string, { count: number; boardName: string }> = {};
        for (const { board, records } of results) {
          for (const rec of records) {
            const link = getWorkspaceDataLink(rec.meta as Record<string, unknown> | null);
            if (!link) continue;
            const key = link.sourceObjectId;
            next[key] = { count: (next[key]?.count || 0) + 1, boardName: board.name };
          }
        }
        setPushedCounts(next);
      });
    } catch {
      setArea(null);
      setObjects([]);
    } finally {
      setLoading(false);
    }
  }, [areaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadLog = useCallback(async () => {
    if (!areaId) return;
    setLogLoading(true);
    try {
      setLogEntries(await fetchWorkspaceAreaActivityLog(areaId));
    } catch {
      setLogEntries([]);
    } finally {
      setLogLoading(false);
    }
  }, [areaId]);

  useEffect(() => {
    if (tab === 'log') void loadLog();
  }, [tab, loadLog]);

  const loadBindings = useCallback(async () => {
    const boardObjs = objects.filter((o) => getWorkspaceTableKind(o.meta) === 'board');
    if (!boardObjs.length) {
      setBindRows([]);
      return;
    }
    setBindLoading(true);
    try {
      const nameOf = (id: string) => objects.find((o) => o.id === id)?.name || id;
      const perTable = await Promise.all(
        boardObjs.map(async (o) => {
          const fields = await fetchCustomObjectFields(o.id).catch(() => [] as CustomObjectField[]);
          const rows: BindRow[] = [];
          for (const f of fields) {
            const b = parseWorkspaceColumnBindingV1(f.meta);
            if (!b) continue;
            rows.push({
              tableId: o.id,
              tableName: o.name,
              fieldKey: f.key,
              fieldLabel: f.label,
              mode: b.mode,
              summary: bindingSummary(b, nameOf),
            });
          }
          return rows;
        }),
      );
      setBindRows(perTable.flat());
    } finally {
      setBindLoading(false);
    }
  }, [objects]);

  useEffect(() => {
    if (tab === 'bindings') void loadBindings();
  }, [tab, loadBindings]);

  const recentIds = useMemo(() => (areaId ? readRecentWorkspaceTables(areaId) : []), [areaId, objects]);
  const recentObjects = useMemo(() => {
    const map = new Map(objects.map((o) => [o.id, o]));
    return recentIds.map((id) => map.get(id)).filter(Boolean) as CustomObject[];
  }, [recentIds, objects]);

  const bindings: WorkspaceIntegrationBinding[] = useMemo(
    () => readWorkspaceIntegrationBindings(area?.meta),
    [area?.meta],
  );
  const dataObjects = useMemo(
    () => objects.filter((o) => getWorkspaceTableKind(o.meta) === 'data'),
    [objects],
  );
  const boardObjects = useMemo(
    () => objects.filter((o) => getWorkspaceTableKind(o.meta) === 'board'),
    [objects],
  );

  const AreaIcon = (area?.iconKey && NAV_ICON_MAP[area.iconKey as NavIconKey]) || NAV_ICON_MAP.folder;

  const openTable = (o: CustomObject) => {
    if (areaId) touchRecentWorkspaceTable(areaId, o.id);
    navigate(`/workspace/${o.id}/table`);
  };

  const openPushAll = async (o: CustomObject) => {
    setPushLoadingId(o.id);
    try {
      const [records, fields] = await Promise.all([
        fetchAllCustomObjectRecords(o.id),
        fetchCustomObjectFields(o.id),
      ]);
      setPushState({
        sourceObjectId: o.id,
        recordIds: records.map((r) => r.id),
        sourceFields: fields.filter((f) => f.isActive),
      });
    } finally {
      setPushLoadingId(null);
    }
  };

  const downloadCsv = async (o: CustomObject) => {
    setDownloadLoadingId(o.id);
    try {
      const [records, fields] = await Promise.all([
        fetchAllCustomObjectRecords(o.id),
        fetchCustomObjectFields(o.id),
      ]);
      const cols = fields.filter((f) => f.isActive).sort((a, b) => a.order - b.order);
      const esc = (v: unknown) => {
        const s = v === null || v === undefined ? '' : String(v);
        return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [
        cols.map((f) => esc(f.label)).join(';'),
        ...records.map((r) => cols.map((f) => esc(r.values?.[f.key])).join(';')),
      ];
      const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${o.name}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadLoadingId(null);
    }
  };

  // ---- flow map: click-to-focus/dim across source / data / board lanes ----
  const nodeId = (kind: 'source' | 'data' | 'board', id: string) => `${kind}:${id}`;

  const related = useMemo(() => {
    if (!focusId) return null;
    const sep = focusId.indexOf(':');
    const kind = focusId.slice(0, sep);
    const id = focusId.slice(sep + 1);
    const set = new Set<string>([focusId]);
    if (kind === 'source') {
      const b = bindings.find((x) => x.id === id);
      if (b?.targetObjectId) {
        set.add(nodeId('data', b.targetObjectId));
        for (const board of boardObjects) {
          if (linkedDataIds(board).includes(b.targetObjectId)) set.add(nodeId('board', board.id));
        }
      }
    } else if (kind === 'data') {
      for (const b of bindings) if (b.targetObjectId === id) set.add(nodeId('source', b.id));
      for (const board of boardObjects) {
        if (linkedDataIds(board).includes(id)) set.add(nodeId('board', board.id));
      }
    } else if (kind === 'board') {
      const board = boardObjects.find((o) => o.id === id);
      const linked = board ? linkedDataIds(board) : [];
      for (const dId of linked) {
        set.add(nodeId('data', dId));
        for (const b of bindings) if (b.targetObjectId === dId) set.add(nodeId('source', b.id));
      }
    }
    return set;
  }, [focusId, bindings, boardObjects]);

  const nodeClass = (id: string, extra = '') => {
    let cls = `ws-node${extra ? ` ${extra}` : ''}`;
    if (related) cls += related.has(id) ? ' on' : ' mute';
    return cls;
  };

  const onNodeClick = (kind: 'source' | 'data' | 'board', id: string) => {
    const fid = nodeId(kind, id);
    if (focusId === fid) {
      if (kind === 'source') {
        setIntegrationsOpen(true);
      } else {
        const o = objects.find((x) => x.id === id);
        if (o) openTable(o);
      }
      setFocusId(null);
    } else {
      setFocusId(fid);
    }
  };

  if (!areaId || !/^[0-9a-f-]{36}$/i.test(areaId)) {
    return (
      <MainLayout>
        <div className="p-8 text-slate-600">…</div>
      </MainLayout>
    );
  }

  if (!loading && !area) {
    return (
      <MainLayout>
        <div className="max-w-xl mx-auto p-8 text-center text-slate-600">
          {t('crm.workspace.tablesList.loadError')}
        </div>
      </MainLayout>
    );
  }

  const visibleMembers = members.slice(0, 5);
  const extraMembers = members.length - visibleMembers.length;

  return (
    <MainLayout>
      <div className="ws-page max-w-6xl mx-auto">
        {area && <WsAreaBar areaId={area.id} areaName={area.name} areaIconKey={area.iconKey} />}

        <div className="ws-head">
          <span className="ws-icon" style={{ background: area?.iconColor || undefined }}>
            <AreaIcon className="!h-[20px] !w-[20px]" />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1>{area?.name}</h1>
            {area?.description && <div className="desc">{area.description}</div>}
          </div>
          <div className="ws-people">
            {visibleMembers.map((m) => (
              <span className="a" key={m.id} title={m.staffUser?.fullName || m.staffUser?.email || ''}>
                {initials(m.staffUser?.fullName, m.staffUser?.email || '?')}
              </span>
            ))}
            {extraMembers > 0 && <span className="more">+{extraMembers}</span>}
            <button
              type="button"
              className="tb-icon-btn"
              style={{ marginLeft: 10 }}
              onClick={() => navigate(`/workspace/areas/${areaId}/settings`)}
            >
              <NAV_ICON_MAP.settings className="!h-[13px] !w-[13px]" />
              {t('crm.workspace.areasList.settings')}
            </button>
          </div>
        </div>

        <div className="toolbar">
          <button type="button" className="btn btn-sm" onClick={() => setIntegrationsOpen(true)}>
            {t('crm.workspace.area.integrations')}
          </button>
          <span className="toolbar-spacer" />
          <button
            type="button"
            onClick={() => navigate(`/workspace/new?workspaceAreaId=${areaId}&finish=table&kind=data`)}
            className="btn btn-sm"
          >
            {t('crm.workspace.area.newDataTable')}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/workspace/new?workspaceAreaId=${areaId}&finish=table&kind=board`)}
            className="btn btn-primary btn-sm"
          >
            {t('crm.workspace.area.newBoardTable')}
          </button>
        </div>

        <div className="ws-map">
          <div className="ws-lane">
            <div className="ws-lane-head">
              <span className="n">01</span>
              <span className="t">{t('crm.workspace.area.mapSources')}</span>
              <span className="c">{bindings.length}</span>
            </div>
            <div className="ws-lane-body">
              {bindings.map((b) => {
                const connected = workspaceBindingHasActiveIntegration(b, connections, marketingRows);
                return (
                  <button
                    key={b.id}
                    type="button"
                    className={nodeClass(nodeId('source', b.id))}
                    onClick={() => onNodeClick('source', b.id)}
                  >
                    <span className="ico">
                      <SourceIcon catalogKey={b.catalogKey} className="!h-[13px] !w-[13px]" />
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span className="nm">{b.label}</span>
                    </span>
                    <span className={`st${connected ? '' : ' warn'}`} />
                  </button>
                );
              })}
              <button type="button" className="ws-node add" onClick={() => setIntegrationsOpen(true)}>
                <NavIconPlus className="!h-3.5 !w-3.5" /> {t('crm.workspace.area.mapAddSource')}
              </button>
            </div>
          </div>

          <div className="ws-arrow">→</div>

          <div className="ws-lane">
            <div className="ws-lane-head">
              <span className="n">02</span>
              <span className="t">{t('crm.workspace.area.mapData')}</span>
              <span className="c">{dataObjects.length}</span>
            </div>
            <div className="ws-lane-body">
              {dataObjects.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={nodeClass(nodeId('data', o.id))}
                  onClick={() => onNodeClick('data', o.id)}
                >
                  <span className="ico">
                    <NAV_ICON_MAP.table className="!h-[13px] !w-[13px]" />
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="nm">{o.name}</span>
                  </span>
                </button>
              ))}
              <button
                type="button"
                className="ws-node add"
                onClick={() => navigate(`/workspace/new?workspaceAreaId=${areaId}&finish=table&kind=data`)}
              >
                <NavIconPlus className="!h-3.5 !w-3.5" /> {t('crm.workspace.area.newDataTable')}
              </button>
            </div>
          </div>

          <div className="ws-arrow">→</div>

          <div className="ws-lane">
            <div className="ws-lane-head">
              <span className="n">03</span>
              <span className="t">{t('crm.workspace.area.mapBoards')}</span>
              <span className="c">{boardObjects.length}</span>
            </div>
            <div className="ws-lane-body">
              {boardObjects.map((o) => {
                const v = parseEnabledViews(o.meta);
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={nodeClass(nodeId('board', o.id), 'board')}
                    onClick={() => onNodeClick('board', o.id)}
                  >
                    <span className="ico">
                      <NAV_ICON_MAP.table className="!h-[13px] !w-[13px]" />
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span className="nm">{o.name}</span>
                      <div className="ws-views">
                        <span className="ws-view on">{t('crm.workspace.views.table')}</span>
                        {v.kanban && <span className="ws-view on">{t('crm.workspace.views.kanban')}</span>}
                        {v.calendar && <span className="ws-view on">{t('crm.workspace.views.calendar')}</span>}
                        {v.gantt && <span className="ws-view on">{t('crm.workspace.views.gantt')}</span>}
                        {v.analytics && <span className="ws-view on">{t('crm.workspace.views.analytics')}</span>}
                      </div>
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                className="ws-node add"
                onClick={() => navigate(`/workspace/new?workspaceAreaId=${areaId}&finish=table&kind=board`)}
              >
                <NavIconPlus className="!h-3.5 !w-3.5" /> {t('crm.workspace.area.newBoardTable')}
              </button>
            </div>
          </div>
        </div>

        <div className="view-tabs">
          {(
            [
              ['recent', t('crm.workspace.area.tabRecent')],
              ['content', t('crm.workspace.area.tabContent')],
              ['sources', t('crm.workspace.area.tabSources')],
              ['bindings', t('crm.workspace.area.tabBindings')],
              ['log', t('crm.workspace.area.tabLog')],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`view-tab${tab === k ? ' active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'recent' && (
          <div className="ws-panel">
            {recentObjects.length === 0 && (
              <div className="ws-row" style={{ gridTemplateColumns: '1fr' }}>
                <span className="ws-note">{t('crm.workspace.gantt.empty')}</span>
              </div>
            )}
            {recentObjects.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => openTable(o)}
                className="ws-row"
                style={{ width: '100%', border: 0, borderBottom: '1px solid var(--line-3)', background: 'none', cursor: 'pointer', font: 'inherit' }}
              >
                <div className="ws-cellmain">
                  <span className="ico">
                    <NAV_ICON_MAP.table className="!h-[14px] !w-[14px]" />
                  </span>
                  <span className="nm">{o.name}</span>
                </div>
                <span className="ws-badge">
                  {getWorkspaceTableKind(o.meta) === 'board' ? t('crm.workspace.kindBadge.shortBoard') : t('crm.workspace.kindBadge.shortData')}
                </span>
              </button>
            ))}
          </div>
        )}

        {tab === 'content' && (
          <div className="ws-panel">
            {objects.length === 0 && (
              <div className="ws-row" style={{ gridTemplateColumns: '1fr' }}>
                <span className="ws-note">{t('crm.workspace.tablesList.empty')}</span>
              </div>
            )}
            {objects.map((o) => {
              const v = parseEnabledViews(o.meta);
              const views = [
                v.table && t('crm.workspace.views.table'),
                v.kanban && t('crm.workspace.views.kanban'),
                v.calendar && t('crm.workspace.views.calendar'),
                v.analytics && t('crm.workspace.views.analytics'),
                v.gantt && t('crm.workspace.views.gantt'),
              ]
                .filter(Boolean)
                .join(', ');
              const kind = getWorkspaceTableKind(o.meta);
              const fedFrom = kind === 'board'
                ? linkedDataIds(o).map((id) => objects.find((x) => x.id === id)).filter(Boolean) as CustomObject[]
                : [];
              const sourcesOf = kind === 'data' ? bindings.filter((b) => b.targetObjectId === o.id) : [];
              const pushed = pushedCounts[o.id];
              const readyCount = Math.max(0, (dataRecordCounts[o.id] ?? 0) - (pushed?.count ?? 0));
              return (
                <div className="ws-row" key={o.id}>
                  <div style={{ minWidth: 0 }}>
                    <div className="ws-cellmain">
                      <span className="ico">
                        <NAV_ICON_MAP.table className="!h-[14px] !w-[14px]" />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <button type="button" className="nm" style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0, textAlign: 'left', font: 'inherit', color: 'inherit' }} onClick={() => openTable(o)}>
                          {o.name}
                        </button>
                        <div className="sub">{views || '—'}</div>
                      </span>
                    </div>
                    {fedFrom.length > 0 && (
                      <div className="ws-chain ws-cellmore">
                        <span className="lbl">{t('crm.workspace.area.contentFedFrom')}</span>
                        {fedFrom.map((d) => (
                          <button key={d.id} type="button" className="it" onClick={() => openTable(d)}>
                            <NAV_ICON_MAP.table className="!h-[11px] !w-[11px]" />
                            {d.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {sourcesOf.length > 0 && (
                      <div className="ws-chain ws-cellmore">
                        <span className="lbl">{t('crm.workspace.area.contentSourcesOf')}</span>
                        {sourcesOf.map((b) => (
                          <button key={b.id} type="button" className="it" onClick={() => setIntegrationsOpen(true)}>
                            <SourceIcon catalogKey={b.catalogKey} className="!h-[11px] !w-[11px]" />
                            {b.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className={`ws-badge${kind === 'board' ? ' board' : ''}`}>
                    {kind === 'board' ? t('crm.workspace.kindBadge.board') : t('crm.workspace.kindBadge.data')}
                  </span>
                  <span className="ws-v">
                    {new Date(o.createdAt).toLocaleDateString()}
                    {kind === 'data' && pushed && (
                      <div className="mono" style={{ marginTop: 2 }}>
                        {t('crm.workspace.area.contentPushedTo', { name: pushed.boardName, count: pushed.count })}
                      </div>
                    )}
                  </span>
                  <div className="ws-acts">
                    {kind === 'data' && (
                      <>
                        <button
                          type="button"
                          className="tb-icon-btn"
                          disabled={pushLoadingId === o.id || readyCount === 0}
                          onClick={() => void openPushAll(o)}
                        >
                          {pushLoadingId === o.id
                            ? '…'
                            : readyCount > 0
                              ? t('crm.workspace.area.pushAllButton', { count: readyCount })
                              : t('crm.workspace.area.contentAllPushed')}
                        </button>
                        <button
                          type="button"
                          className="tb-icon-btn"
                          title={t('crm.workspace.area.contentDownloadCsv')}
                          disabled={downloadLoadingId === o.id}
                          onClick={() => void downloadCsv(o)}
                        >
                          {downloadLoadingId === o.id ? '…' : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 3v12" />
                              <path d="M7 11l5 5 5-5" />
                              <path d="M5 20h14" />
                            </svg>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'sources' && (
          <div>
            <div className="ws-panel">
              {bindings.length === 0 && (
                <div className="ws-row" style={{ gridTemplateColumns: '1fr' }}>
                  <span className="ws-note">{t('crm.workspace.area.sourcesEmpty')}</span>
                </div>
              )}
              {bindings.map((b) => {
                const connected = workspaceBindingHasActiveIntegration(b, connections, marketingRows);
                const target = b.targetObjectId ? objects.find((o) => o.id === b.targetObjectId) : null;
                return (
                  <div className="ws-row" key={b.id}>
                    <div className="ws-cellmain">
                      <span className="ico">
                        <SourceIcon catalogKey={b.catalogKey} className="!h-[14px] !w-[14px]" />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span className="nm">{b.label}</span>
                        <div className="sub">
                          {target
                            ? t('crm.workspace.area.sourceTarget', { name: target.name })
                            : t('crm.workspace.area.sourceNoTarget')}
                        </div>
                      </span>
                    </div>
                    <span className={`ws-badge ${connected ? 'ok' : 'warn'}`}>
                      <span className="d" />
                      {connected ? t('crm.workspace.area.sourceConnected') : t('crm.workspace.area.sourceNotConnected')}
                    </span>
                    <span className="ws-v mono">{b.catalogKey}</span>
                    <div className="ws-acts" />
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-sm" onClick={() => setIntegrationsOpen(true)}>
                {t('crm.workspace.area.sourcesManage')}
              </button>
            </div>
          </div>
        )}

        {tab === 'bindings' && (
          <div className="ws-panel" style={{ overflowX: 'auto' }}>
            {bindLoading && (
              <div className="ws-row" style={{ gridTemplateColumns: '1fr' }}>
                <span className="ws-note">{t('crm.workspace.common.loading')}</span>
              </div>
            )}
            {!bindLoading && (!bindRows || bindRows.length === 0) && (
              <div className="ws-row" style={{ gridTemplateColumns: '1fr' }}>
                <span className="ws-note">{t('crm.workspace.area.bindingsEmpty')}</span>
              </div>
            )}
            {!bindLoading && bindRows && bindRows.length > 0 && (
              <table className="ws-bind">
                <thead>
                  <tr>
                    <th>{t('crm.workspace.area.bindingsTableCol')}</th>
                    <th>{t('crm.workspace.area.bindingsFieldCol')}</th>
                    <th>{t('crm.workspace.area.bindingsModeCol')}</th>
                    <th>{t('crm.workspace.area.bindingsSourceCol')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {bindRows.map((r, i) => (
                    <tr key={`${r.tableId}-${r.fieldKey}-${i}`}>
                      <td className="col">{r.tableName}</td>
                      <td>
                        {r.fieldLabel}
                        <span className="key"> ({r.fieldKey})</span>
                      </td>
                      <td>
                        <span className="ws-mode">
                          {r.mode === 'from_pushed_source' && t('crm.workspace.table.columnBindingPushed')}
                          {r.mode === 'lookup_by_key' && t('crm.workspace.table.columnBindingLookup')}
                          {r.mode === 'pick_from_data' && t('crm.workspace.table.columnBindingPickFromData')}
                          {r.mode === 'rollup' && t('crm.workspace.table.columnBindingRollup')}
                          {r.mode === 'cached_snapshot' && t('crm.workspace.area.bindModeCachedSnapshot')}
                        </span>
                      </td>
                      <td>{r.summary}</td>
                      <td>
                        <button
                          type="button"
                          className="tb-icon-btn"
                          onClick={() => navigate(`/workspace/${r.tableId}/table`)}
                        >
                          {t('crm.workspace.area.bindingsEdit')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'log' && (
          <div className="ws-panel">
            <div className="ws-log">
              {logLoading && <div className="ws-log-item"><span className="tx">{t('crm.workspace.common.loading')}</span></div>}
              {!logLoading && (!logEntries || logEntries.length === 0) && (
                <div className="ws-log-item"><span className="tx">{t('crm.workspace.area.logEmpty')}</span></div>
              )}
              {!logLoading &&
                logEntries?.map((e) => (
                  <div className="ws-log-item" key={e.id}>
                    <span className="ic">{LOG_GLYPH[e.kind] || '•'}</span>
                    <span className="tx">
                      <b>{e.title}</b>
                      {e.detail && <span className="m">{e.detail}</span>}
                    </span>
                    <span className="tm">{new Date(e.createdAt).toLocaleString()}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {area && integrationsOpen && (
        <WorkspaceAreaIntegrationsModal
          open={integrationsOpen}
          area={area}
          onClose={() => setIntegrationsOpen(false)}
          onSaved={(next) => setArea(next)}
        />
      )}

      {pushState && (
        <PushToBoardModal
          open
          onClose={() => setPushState(null)}
          sourceObjectId={pushState.sourceObjectId}
          workspaceAreaId={areaId}
          areaObjects={objects}
          recordIds={pushState.recordIds}
          sourceFields={pushState.sourceFields}
          onSuccess={() => {
            setPushState(null);
            void load();
          }}
        />
      )}
    </MainLayout>
  );
};
