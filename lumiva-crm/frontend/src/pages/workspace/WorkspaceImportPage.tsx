import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchIntegrations,
  previewGa4WorkspaceImportFromMarketing,
  previewMetaAdsWorkspaceImport,
  previewMetaAdsWorkspaceImportFromMarketing,
  previewWooWorkspaceImport,
  syncIntegration,
  syncGa4WorkspaceImportFromMarketing,
  syncMetaAdsWorkspaceImportFromMarketing,
  type IntegrationConnectionDto,
  type WooWorkspacePreviewResult,
} from '../../api/integrations';
import {
  applyCustomObjectImport,
  createCustomObjectField,
  fetchCustomObject,
  fetchCustomObjectFields,
  fetchCustomObjectRecords,
  previewCustomObjectImport,
  type CustomObjectField,
  type CustomObjectImportPreview,
} from '../../api/customObjects';
import {
  fetchWorkspaceArea,
  marketingProviderMatchesWorkspaceCatalog,
  readWorkspaceIntegrationBindings,
  resolveIntegrationIdsForWorkspaceBindings,
  resolveMarketingIntegrationIdsForWorkspaceBindings,
  workspaceBindingHasActiveIntegration,
  type WorkspaceIntegrationBinding,
} from '../../api/workspaceAreas';
import type { MarketingIntegrationRow } from '../../api/marketing';
import { fetchMarketingIntegrations } from '../../api/marketing';
import { normalizeOptionToken } from '../../workspace/normalizeOptionToken';
import { getWorkspaceTableKind } from '../../workspace/workspaceTableKind';

/** Как в таблице/канбане по умолчанию — только если в файле нет ни одного значения статуса */
const DEFAULT_STATUS_FIELD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'working_on_it', label: 'Working on it' },
  { value: 'done', label: 'Done' },
  { value: 'stuck', label: 'Stuck' },
  { value: 'in_review', label: 'In review' },
];

function slugifyStatusValue(label: string): string {
  return normalizeOptionToken(label);
}

/** Уникальные строки из файла → { value, label } для поля status (как на бэкенде при импорте). */
function statusOptionsFromFileValues(values: string[]): Array<{ value: string; label: string }> {
  const used = new Set<string>();
  const out: Array<{ value: string; label: string }> = [];
  for (const raw of values) {
    const labelRaw = raw.trim();
    if (!labelRaw) continue;
    let value = slugifyStatusValue(labelRaw);
    if (!value) continue;
    let v = value;
    let n = 2;
    while (used.has(v)) {
      v = `${value}_${n++}`;
    }
    used.add(v);
    const forDisplay = labelRaw.replace(/_/g, ' ');
    const label =
      forDisplay.length > 0
        ? forDisplay.charAt(0).toUpperCase() + forDisplay.slice(1)
        : v;
    out.push({ value: v, label });
  }
  return out;
}

/** Импорт строк таблицы из внешнего канала (превью + маппинг). */
type WorkspaceTableImportMode = 'woo' | 'meta_ads' | 'ga4';

function getWorkspaceTableImportMode(c: IntegrationConnectionDto): WorkspaceTableImportMode | null {
  if (c.kind === 'woocommerce') return 'woo';
  if (c.kind === 'third_party_link' && c.linkCatalogId === 'meta_ads') return 'meta_ads';
  return null;
}

type ChannelImportState = {
  preview: WooWorkspacePreviewResult | null;
  previewLoading: boolean;
  previewError: string | null;
  columnImport: Record<string, boolean>;
  columnToField: Record<string, string>;
  statusFieldKey: string;
  creatingColumn: string | null;
  syncing: boolean;
  message: string | null;
  wooSyncHintVisible: boolean;
  importMode: 'full' | 'aggregate';
  /** Ключи колонок превью для GROUP BY при суммировании */
  aggregateGroupByColumns: string[];
};

function pickDefaultGroupColumns(columns: string[]): string[] {
  const prefer = [
    'session_source',
    'session_medium',
    'country_id',
    'session_campaign_name',
    'campaign_name',
    'date',
  ];
  const picked: string[] = [];
  for (const p of prefer) {
    if (columns.includes(p)) picked.push(p);
  }
  if (picked.length) return picked.slice(0, 3);
  return columns[0] ? [columns[0]] : [];
}

function emptyChannelImport(): ChannelImportState {
  return {
    preview: null,
    previewLoading: false,
    previewError: null,
    columnImport: {},
    columnToField: {},
    statusFieldKey: '',
    creatingColumn: null,
    syncing: false,
    message: null,
    wooSyncHintVisible: false,
    importMode: 'full',
    aggregateGroupByColumns: [],
  };
}

function ImportGranularityControls({
  channelKey,
  st,
  mergeCh,
}: {
  channelKey: string;
  st: ChannelImportState;
  mergeCh: (id: string, patch: Partial<ChannelImportState>) => void;
}) {
  const { t } = useTranslation();
  const cols = st.preview?.columns ?? [];
  if (!cols.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3 space-y-2 text-sm">
      <div className="text-sm font-medium text-slate-800">
        {t('crm.workspace.import.importGranularityTitle')}
      </div>
      <p className="text-xs text-slate-600">{t('crm.workspace.import.importGranularityLead')}</p>
      <div className="flex flex-wrap gap-3">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`import-mode-${channelKey}`}
            checked={st.importMode === 'full'}
            onChange={() => mergeCh(channelKey, { importMode: 'full' })}
          />
          <span>{t('crm.workspace.import.importModeFull')}</span>
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`import-mode-${channelKey}`}
            checked={st.importMode === 'aggregate'}
            onChange={() => {
              const nextCols =
                st.aggregateGroupByColumns.length > 0
                  ? st.aggregateGroupByColumns
                  : pickDefaultGroupColumns(cols);
              mergeCh(channelKey, {
                importMode: 'aggregate',
                aggregateGroupByColumns: nextCols,
              });
            }}
          />
          <span>{t('crm.workspace.import.importModeAggregate')}</span>
        </label>
      </div>
      {st.importMode === 'aggregate' && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-700">
            {t('crm.workspace.import.aggregateGroupByLabel')}
          </div>
          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
            {cols.map((col) => (
              <label
                key={`agg-${channelKey}-${col}`}
                className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 text-xs"
              >
                <input
                  type="checkbox"
                  checked={st.aggregateGroupByColumns.includes(col)}
                  onChange={(e) => {
                    const on = e.target.checked;
                    const next = on
                      ? [...st.aggregateGroupByColumns, col]
                      : st.aggregateGroupByColumns.filter((c) => c !== col);
                    mergeCh(channelKey, { aggregateGroupByColumns: next });
                  }}
                />
                <span className="truncate max-w-[200px]" title={col}>
                  {col}
                </span>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">{t('crm.workspace.import.aggregateGroupHint')}</p>
        </div>
      )}
    </div>
  );
}

export const WorkspaceImportPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { objectId = '' } = useParams();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CustomObjectImportPreview | null>(null);
  const [fields, setFields] = useState<CustomObjectField[]>([]);
  const [columnToField, setColumnToField] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [creatingForColumn, setCreatingForColumn] = useState<string | null>(null);
  const [importGroupMode, setImportGroupMode] = useState<'keep' | 'existing' | 'new'>('keep');
  const [targetGroup, setTargetGroup] = useState('');
  const [existingGroups, setExistingGroups] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [applyErrors, setApplyErrors] = useState<Array<{ row: number; reason: string }>>([]);
  /** Все включённые подключения, привязанные к рабочей области этой таблицы. */
  const [boundConnections, setBoundConnections] = useState<IntegrationConnectionDto[]>([]);
  /** Интеграции из раздела «Маркетинг» (Meta Ads и т.д.) для привязок области. */
  const [marketingIntegrations, setMarketingIntegrations] = useState<MarketingIntegrationRow[]>([]);
  const [channelImportLoading, setChannelImportLoading] = useState(true);
  const [sharedAreaIssue, setSharedAreaIssue] = useState<
    null | 'no_object_area' | 'no_connection_bindings'
  >(null);
  const [workspaceAreaIdForLink, setWorkspaceAreaIdForLink] = useState<string | null>(null);
  const [integrationsRefreshKey, setIntegrationsRefreshKey] = useState(0);
  const [areaChannelsModalOpen, setAreaChannelsModalOpen] = useState(false);
  /** Привязки из meta области (для карточек «нет подключения в хабе»). */
  const [areaIntegrationBindings, setAreaIntegrationBindings] = useState<
    WorkspaceIntegrationBinding[]
  >([]);
  const [bindingsNeedingHub, setBindingsNeedingHub] = useState<WorkspaceIntegrationBinding[]>([]);
  /** Состояние превью/маппинга по id подключения (Woo / Meta). */
  const [channelImportById, setChannelImportById] = useState<
    Record<string, ChannelImportState>
  >({});
  const [importTableKind, setImportTableKind] = useState<'data' | 'board' | null>(null);

  const marketingMetaRows = useMemo(() => {
    if (!areaIntegrationBindings.length || !marketingIntegrations.length) return [];
    const allowed = resolveMarketingIntegrationIdsForWorkspaceBindings(
      areaIntegrationBindings,
      marketingIntegrations,
    );
    return marketingIntegrations
      .filter(
        (m) =>
          allowed.has(m.id) &&
          marketingProviderMatchesWorkspaceCatalog(m.provider, 'meta_ads'),
      )
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [areaIntegrationBindings, marketingIntegrations]);

  const marketingGaRows = useMemo(() => {
    if (!areaIntegrationBindings.length || !marketingIntegrations.length) return [];
    const allowed = resolveMarketingIntegrationIdsForWorkspaceBindings(
      areaIntegrationBindings,
      marketingIntegrations,
    );
    return marketingIntegrations
      .filter(
        (m) =>
          allowed.has(m.id) &&
          marketingProviderMatchesWorkspaceCatalog(m.provider, 'google_analytics'),
      )
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [areaIntegrationBindings, marketingIntegrations]);

  const areaChannelsCount = useMemo(
    () =>
      boundConnections.length +
      marketingMetaRows.length +
      marketingGaRows.length +
      bindingsNeedingHub.length,
    [boundConnections, marketingMetaRows, marketingGaRows, bindingsNeedingHub],
  );

  useEffect(() => {
    if (!areaChannelsModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAreaChannelsModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [areaChannelsModalOpen]);

  const mergeCh = (id: string, patch: Partial<ChannelImportState>) => {
    setChannelImportById((prev) => ({
      ...prev,
      [id]: { ...emptyChannelImport(), ...prev[id], ...patch },
    }));
  };

  useEffect(() => {
    if (!objectId || !/^[0-9a-f-]{36}$/i.test(objectId)) return;
    let cancelled = false;
    fetchCustomObjectFields(objectId)
      .then((f) => {
        if (!cancelled) setFields(f);
      })
      .catch(() => {});
    fetchCustomObject(objectId)
      .then((o) => {
        if (!cancelled) setImportTableKind(getWorkspaceTableKind(o.meta as Record<string, unknown> | null));
      })
      .catch(() => {
        if (!cancelled) setImportTableKind(null);
      });
    return () => {
      cancelled = true;
    };
  }, [objectId]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        setIntegrationsRefreshKey((k) => k + 1);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setChannelImportLoading(true);
      setSharedAreaIssue(null);
      setWorkspaceAreaIdForLink(null);
      if (!objectId || !/^[0-9a-f-]{36}$/i.test(objectId)) {
        setBoundConnections([]);
        setMarketingIntegrations([]);
        setAreaIntegrationBindings([]);
        setBindingsNeedingHub([]);
        setChannelImportLoading(false);
        setSharedAreaIssue('no_object_area');
        return;
      }
      try {
        const [obj, list, mkt] = await Promise.all([
          fetchCustomObject(objectId),
          fetchIntegrations(),
          fetchMarketingIntegrations().catch(() => [] as MarketingIntegrationRow[]),
        ]);
        if (cancelled) return;
        const mktRows = Array.isArray(mkt) ? mkt : [];
        setMarketingIntegrations(mktRows);
        const wid = obj.workspaceAreaId?.trim();
        if (!wid || !/^[0-9a-f-]{36}$/i.test(wid)) {
          setBoundConnections([]);
          setMarketingIntegrations([]);
          setAreaIntegrationBindings([]);
          setBindingsNeedingHub([]);
          setSharedAreaIssue('no_object_area');
          return;
        }
        setWorkspaceAreaIdForLink(wid);
        const area = await fetchWorkspaceArea(wid);
        if (cancelled) return;
        const bindings = readWorkspaceIntegrationBindings(area.meta);
        setAreaIntegrationBindings(bindings);
        if (bindings.length === 0) {
          setBoundConnections([]);
          setBindingsNeedingHub([]);
          setSharedAreaIssue('no_connection_bindings');
          return;
        }
        const allowed = resolveIntegrationIdsForWorkspaceBindings(bindings, list);
        const bound = list
          .filter(
            (c) => !c.isDeleted && c.isEnabled && allowed.has(c.id),
          )
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        setBoundConnections(bound);
        setBindingsNeedingHub(
          bindings.filter((b) => !workspaceBindingHasActiveIntegration(b, list, mktRows)),
        );
        setSharedAreaIssue(null);
      } catch {
        if (!cancelled) {
          setBoundConnections([]);
          setMarketingIntegrations([]);
          setAreaIntegrationBindings([]);
          setBindingsNeedingHub([]);
          setSharedAreaIssue('no_object_area');
        }
      } finally {
        if (!cancelled) setChannelImportLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [objectId, integrationsRefreshKey]);

  const mappedCount = useMemo(
    () => Object.values(columnToField).filter(Boolean).length,
    [columnToField],
  );
  const fieldOptions = useMemo(
    () =>
      [...fields]
        .filter((f) => f.isActive)
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((f) => ({ value: f.key, label: `${f.label} (${f.key})` })),
    [fields],
  );
  const existingFieldKeys = useMemo(
    () => new Set(fields.map((f) => f.key)),
    [fields],
  );
  const groupField = useMemo(
    () =>
      fields.find((f) => {
        const key = f.key.toLowerCase();
        const label = f.label.toLowerCase();
        return key === 'group' || key === 'group_name' || key.includes('group') || label.includes('груп');
      }) || null,
    [fields],
  );

  const toFieldKey = (columnName: string) => {
    const base =
      columnName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]+/gi, '_')
        .replace(/^_+|_+$/g, '') || 'field';
    let key = base;
    let i = 1;
    while (existingFieldKeys.has(key)) {
      key = `${base}_${i++}`;
    }
    return key;
  };

  const inferType = (columnName: string): CustomObjectField['type'] => {
    const v = columnName.toLowerCase();
    if (v.includes('date') || v.includes('дата')) return 'date';
    if (v.includes('status') || v.includes('статус')) return 'status';
    if (v.includes('priority') || v.includes('приоритет')) return 'select';
    if (v.includes('sum') || v.includes('amount') || v.includes('value') || v.includes('сумм')) return 'number';
    return 'text';
  };

  const pickBestColumnForField = (
    fieldKey: string,
    fieldLabel: string,
    columns: string[],
  ): string | null => {
    const key = fieldKey.toLowerCase();
    const label = fieldLabel.toLowerCase();
    const normCol = (c: string) => c.toLocaleLowerCase('tr-TR').trim();
    const list = columns.map((c) => ({ raw: c, norm: normCol(c) }));

    const preferNameLike =
      key === 'name' || key.includes('name') || label.includes('name') || label.includes('наз');
    if (preferNameLike) {
      const preferred = list.find(
        (c) =>
          c.norm.includes('name') ||
          c.norm.includes('title') ||
          c.norm.includes('hotel') ||
          c.norm.includes('назв') ||
          c.norm.includes('проект') ||
          c.norm.includes('organiz') ||
          c.norm.includes('орган') ||
          c.norm.includes('firma') ||
          c.norm.includes('şirket'),
      );
      if (preferred) return preferred.raw;
    }

    const exact = list.find((c) => c.norm === key || c.norm === label);
    if (exact) return exact.raw;
    const partial = list.find((c) => c.norm.includes(key) || c.norm.includes(label));
    if (partial) return partial.raw;
    return columns[0] || null;
  };

  const suggestWooFieldForColumn = (col: string, fieldList: CustomObjectField[]): string => {
    const cn = col.toLowerCase().replace(/\s+/g, '_');
    const exact = fieldList.find(
      (f) =>
        f.key.toLowerCase() === cn ||
        f.key.toLowerCase() === col.toLowerCase() ||
        f.key.toLowerCase().replace(/_/g, '') === cn.replace(/_/g, ''),
    );
    if (exact) return exact.key;

    /** Не матчим короткие ключи вроде «id» подстрокой длинных имён колонок (line_item_first_product_id → id). */
    const minSubLen = 4;
    const labelPrefix = (f: CustomObjectField) => {
      const raw = (f.label || '').toLowerCase().trim();
      if (raw.length < minSubLen) return '';
      return raw.slice(0, Math.min(12, raw.length));
    };
    const sub = fieldList.find((f) => {
      const fk = f.key.toLowerCase();
      const cnIncludesFk = fk.length >= minSubLen && cn.includes(fk);
      const fkIncludesCn = cn.length >= minSubLen && fk.includes(cn);
      const lp = labelPrefix(f);
      const labelSub = lp.length >= minSubLen && cn.includes(lp);
      return cnIncludesFk || fkIncludesCn || labelSub;
    });
    return sub?.key || '';
  };

  const refreshChannelIntegrationsAfterSync = async () => {
    if (!objectId || !/^[0-9a-f-]{36}$/i.test(objectId)) return;
    try {
      const obj = await fetchCustomObject(objectId);
      const wid = obj.workspaceAreaId?.trim();
      if (!wid || !/^[0-9a-f-]{36}$/i.test(wid)) return;
      const area = await fetchWorkspaceArea(wid);
      const bindings = readWorkspaceIntegrationBindings(area.meta);
      setAreaIntegrationBindings(bindings);
      const [list, mkt] = await Promise.all([
        fetchIntegrations(),
        fetchMarketingIntegrations().catch(() => [] as MarketingIntegrationRow[]),
      ]);
      const mktRows = Array.isArray(mkt) ? mkt : [];
      setMarketingIntegrations(mktRows);
      const allowed = resolveIntegrationIdsForWorkspaceBindings(bindings, list);
      const bound = list
        .filter((c) => !c.isDeleted && c.isEnabled && allowed.has(c.id))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      setBoundConnections(bound);
      setBindingsNeedingHub(
        bindings.filter((b) => !workspaceBindingHasActiveIntegration(b, list, mktRows)),
      );
    } catch {
      /* ignore */
    }
  };

  const loadChannelPreview = async (c: IntegrationConnectionDto) => {
    const mode = getWorkspaceTableImportMode(c);
    if (!mode || !objectId || !/^[0-9a-f-]{36}$/i.test(objectId)) return;
    mergeCh(c.id, { previewLoading: true, previewError: null });
    setMessage(null);
    try {
      const [freshFields, res] = await Promise.all([
        fetchCustomObjectFields(objectId),
        mode === 'woo'
          ? previewWooWorkspaceImport(c.id, objectId)
          : previewMetaAdsWorkspaceImport(c.id, objectId),
      ]);
      setFields(freshFields);
      const nextImport: Record<string, boolean> = {};
      const nextMap: Record<string, string> = {};
      for (const col of res.columns) {
        nextImport[col] = true;
        nextMap[col] = suggestWooFieldForColumn(col, freshFields);
      }
      const st = freshFields.find((f) => f.type === 'status');
      mergeCh(c.id, {
        preview: res,
        previewLoading: false,
        previewError: null,
        columnImport: nextImport,
        columnToField: nextMap,
        statusFieldKey: st?.key || '',
        importMode: 'full',
        aggregateGroupByColumns: pickDefaultGroupColumns(res.columns),
      });
    } catch (e: any) {
      mergeCh(c.id, {
        preview: null,
        previewLoading: false,
        previewError:
          e?.message ||
          (mode === 'woo'
            ? t('crm.workspace.import.wooPreviewError')
            : t('crm.workspace.import.metaPreviewError')),
      });
    }
  };

  const marketingMetaChannelKey = (row: MarketingIntegrationRow) => `mkt:${row.id}`;

  const loadMarketingMetaChannelPreview = async (row: MarketingIntegrationRow) => {
    if (!objectId || !/^[0-9a-f-]{36}$/i.test(objectId)) return;
    const key = marketingMetaChannelKey(row);
    mergeCh(key, { previewLoading: true, previewError: null });
    setMessage(null);
    try {
      const [freshFields, res] = await Promise.all([
        fetchCustomObjectFields(objectId),
        previewMetaAdsWorkspaceImportFromMarketing(row.id, objectId),
      ]);
      setFields(freshFields);
      const nextImport: Record<string, boolean> = {};
      const nextMap: Record<string, string> = {};
      for (const col of res.columns) {
        nextImport[col] = true;
        nextMap[col] = suggestWooFieldForColumn(col, freshFields);
      }
      const st = freshFields.find((f) => f.type === 'status');
      mergeCh(key, {
        preview: res,
        previewLoading: false,
        previewError: null,
        columnImport: nextImport,
        columnToField: nextMap,
        statusFieldKey: st?.key || '',
        importMode: 'full',
        aggregateGroupByColumns: pickDefaultGroupColumns(res.columns),
      });
    } catch (e: any) {
      mergeCh(key, {
        preview: null,
        previewLoading: false,
        previewError: e?.message || t('crm.workspace.import.metaPreviewError'),
      });
    }
  };

  const createMappedFieldFromChannelColumn = async (
    channelKey: string,
    mode: WorkspaceTableImportMode,
    column: string,
    ch: ChannelImportState,
  ) => {
    if (!mode || !objectId || !ch.preview) return;
    mergeCh(channelKey, { creatingColumn: column });
    setMessage(null);
    try {
      const preview = ch.preview;

      const key = toFieldKey(column);
      const rawType =
        column === 'status' || column.toLowerCase().includes('status')
          ? 'status'
          : inferType(column);
      const type = rawType === 'file' ? 'text' : rawType;
      const payload: Parameters<typeof createCustomObjectField>[1] = {
        key,
        label: column.trim() || key,
        type,
      };
      if (type === 'status' || type === 'select') {
        const uniques =
          preview.uniqueValuesByColumn?.[column]?.filter((s) => s.trim()) ?? [];
        payload.options =
          uniques.length > 0
            ? statusOptionsFromFileValues(uniques)
            : type === 'status'
              ? DEFAULT_STATUS_FIELD_OPTIONS
              : [
                  { value: 'low', label: 'Low' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'high', label: 'High' },
                ];
      }
      const created = await createCustomObjectField(objectId, payload);
      setFields((prev) => [...prev, created]);
      mergeCh(channelKey, {
        columnToField: { ...ch.columnToField, [column]: created.key },
        creatingColumn: null,
        statusFieldKey:
          created.type === 'status' && !ch.statusFieldKey.trim()
            ? created.key
            : ch.statusFieldKey,
      });
      setMessage(t('crm.workspace.import.fieldCreated', { label: created.label, column }));
    } catch (e: any) {
      mergeCh(channelKey, { creatingColumn: null });
      setMessage(e?.message || t('crm.workspace.import.createFieldError', { column }));
    }
  };

  const buildMappedWorkspaceImportPayload = (st: ChannelImportState) => {
    const enabledWooColumns = st.preview!.columns.filter(
      (col) => st.columnImport[col] && (st.columnToField[col] || '').trim(),
    );
    const wooColumnToFieldKey: Record<string, string> = {};
    enabledWooColumns.forEach((col) => {
      wooColumnToFieldKey[col] = st.columnToField[col].trim();
    });
    const statusFieldKey = st.statusFieldKey.trim() || null;
    if (st.importMode === 'aggregate') {
      const aggregateGroupBySourceKeys = st.aggregateGroupByColumns.filter((c) =>
        enabledWooColumns.includes(c),
      );
      return {
        enabledWooColumns,
        wooColumnToFieldKey,
        statusFieldKey,
        importMode: 'aggregate' as const,
        aggregateGroupBySourceKeys,
      };
    }
    return {
      enabledWooColumns,
      wooColumnToFieldKey,
      statusFieldKey,
      importMode: 'full' as const,
    };
  };

  const runChannelSync = async (c: IntegrationConnectionDto, st: ChannelImportState) => {
    const mode = getWorkspaceTableImportMode(c);
    if (!mode || !objectId) return;
    if (!st.preview || !st.preview.columns.length) {
      mergeCh(c.id, {
        message:
          mode === 'woo'
            ? t('crm.workspace.import.wooNeedPreview')
            : t('crm.workspace.import.metaNeedPreview'),
      });
      return;
    }
    const payload = buildMappedWorkspaceImportPayload(st);
    if (payload.enabledWooColumns.length === 0) {
      mergeCh(c.id, {
        message:
          mode === 'woo'
            ? t('crm.workspace.import.wooNoColumnsSelected')
            : t('crm.workspace.import.metaNoColumnsSelected'),
      });
      return;
    }
    if (
      st.importMode === 'aggregate' &&
      payload.importMode === 'aggregate' &&
      payload.aggregateGroupBySourceKeys.length === 0
    ) {
      mergeCh(c.id, {
        message: t('crm.workspace.import.aggregateNeedGroupColumns'),
      });
      return;
    }

    mergeCh(c.id, { syncing: true, message: null, wooSyncHintVisible: false });
    try {
      const res = await syncIntegration(c.id, {
        customObjectId: objectId,
        ...(mode === 'woo'
          ? { wooWorkspaceImport: payload }
          : { metaAdsWorkspaceImport: payload }),
      });
      const base = res.message?.trim();
      const skippedPart =
        (res.skipped ?? 0) > 0
          ? t('crm.workspace.import.syncSkippedSuffix', { count: res.skipped ?? 0 })
          : '';
      mergeCh(c.id, {
        syncing: false,
        message:
          base ||
          (mode === 'woo'
            ? t('crm.workspace.import.wooSyncResultDetailed', {
                salesCreated: res.created,
                salesUpdated: res.updated,
                workspaceCreated: res.workspaceCreated ?? 0,
                workspaceUpdated: res.workspaceUpdated ?? 0,
                skippedPart,
              })
            : t('crm.workspace.import.channelWorkspaceSyncOk', {
                workspaceCreated: res.workspaceCreated ?? 0,
                workspaceUpdated: res.workspaceUpdated ?? 0,
              })),
        wooSyncHintVisible: mode === 'woo',
      });
      await refreshChannelIntegrationsAfterSync();
    } catch (e: any) {
      mergeCh(c.id, { syncing: false, wooSyncHintVisible: false, message: e?.message || 'Sync failed' });
    }
  };

  const runMarketingMetaChannelSync = async (row: MarketingIntegrationRow, st: ChannelImportState) => {
    if (!objectId) return;
    if (!st.preview || !st.preview.columns.length) {
      mergeCh(marketingMetaChannelKey(row), {
        message: t('crm.workspace.import.metaNeedPreview'),
      });
      return;
    }
    const payload = buildMappedWorkspaceImportPayload(st);
    if (payload.enabledWooColumns.length === 0) {
      mergeCh(marketingMetaChannelKey(row), {
        message: t('crm.workspace.import.metaNoColumnsSelected'),
      });
      return;
    }
    if (
      st.importMode === 'aggregate' &&
      payload.importMode === 'aggregate' &&
      payload.aggregateGroupBySourceKeys.length === 0
    ) {
      mergeCh(marketingMetaChannelKey(row), {
        message: t('crm.workspace.import.aggregateNeedGroupColumns'),
      });
      return;
    }
    const key = marketingMetaChannelKey(row);
    mergeCh(key, { syncing: true, message: null, wooSyncHintVisible: false });
    try {
      const res = await syncMetaAdsWorkspaceImportFromMarketing(row.id, {
        customObjectId: objectId,
        metaAdsWorkspaceImport: payload,
      });
      const base = res.message?.trim();
      mergeCh(key, {
        syncing: false,
        message:
          base ||
          t('crm.workspace.import.channelWorkspaceSyncOk', {
            workspaceCreated: res.workspaceCreated ?? 0,
            workspaceUpdated: res.workspaceUpdated ?? 0,
          }),
        wooSyncHintVisible: false,
      });
      await refreshChannelIntegrationsAfterSync();
    } catch (e: any) {
      mergeCh(key, { syncing: false, message: e?.message || 'Sync failed' });
    }
  };

  const loadMarketingGaChannelPreview = async (row: MarketingIntegrationRow) => {
    if (!objectId || !/^[0-9a-f-]{36}$/i.test(objectId)) return;
    const key = marketingMetaChannelKey(row);
    mergeCh(key, { previewLoading: true, previewError: null });
    setMessage(null);
    try {
      const [freshFields, res] = await Promise.all([
        fetchCustomObjectFields(objectId),
        previewGa4WorkspaceImportFromMarketing(row.id, objectId),
      ]);
      setFields(freshFields);
      const nextImport: Record<string, boolean> = {};
      const nextMap: Record<string, string> = {};
      for (const col of res.columns) {
        nextImport[col] = true;
        nextMap[col] = suggestWooFieldForColumn(col, freshFields);
      }
      const st = freshFields.find((f) => f.type === 'status');
      mergeCh(key, {
        preview: res,
        previewLoading: false,
        previewError: null,
        columnImport: nextImport,
        columnToField: nextMap,
        statusFieldKey: st?.key || '',
        importMode: 'full',
        aggregateGroupByColumns: pickDefaultGroupColumns(res.columns),
      });
    } catch (e: any) {
      mergeCh(key, {
        preview: null,
        previewLoading: false,
        previewError: e?.message || t('crm.workspace.import.gaPreviewError'),
      });
    }
  };

  const runMarketingGaChannelSync = async (row: MarketingIntegrationRow, st: ChannelImportState) => {
    if (!objectId) return;
    if (!st.preview || !st.preview.columns.length) {
      mergeCh(marketingMetaChannelKey(row), {
        message: t('crm.workspace.import.gaNeedPreview'),
      });
      return;
    }
    const payload = buildMappedWorkspaceImportPayload(st);
    if (payload.enabledWooColumns.length === 0) {
      mergeCh(marketingMetaChannelKey(row), {
        message: t('crm.workspace.import.gaNoColumnsSelected'),
      });
      return;
    }
    if (
      st.importMode === 'aggregate' &&
      payload.importMode === 'aggregate' &&
      payload.aggregateGroupBySourceKeys.length === 0
    ) {
      mergeCh(marketingMetaChannelKey(row), {
        message: t('crm.workspace.import.aggregateNeedGroupColumns'),
      });
      return;
    }
    const key = marketingMetaChannelKey(row);
    mergeCh(key, { syncing: true, message: null, wooSyncHintVisible: false });
    try {
      const res = await syncGa4WorkspaceImportFromMarketing(row.id, {
        customObjectId: objectId,
        ga4WorkspaceImport: payload,
      });
      const base = res.message?.trim();
      mergeCh(key, {
        syncing: false,
        message:
          base ||
          t('crm.workspace.import.channelWorkspaceSyncOk', {
            workspaceCreated: res.workspaceCreated ?? 0,
            workspaceUpdated: res.workspaceUpdated ?? 0,
          }),
        wooSyncHintVisible: false,
      });
      await refreshChannelIntegrationsAfterSync();
    } catch (e: any) {
      mergeCh(key, { syncing: false, message: e?.message || 'Sync failed' });
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setMessage(null);
    try {
      const [previewRes, fields, records] = await Promise.all([
        previewCustomObjectImport(objectId, file),
        fetchCustomObjectFields(objectId),
        fetchCustomObjectRecords(objectId).catch(() => ({ items: [], total: 0 })),
      ]);
      setPreview(previewRes);
      setFields(fields);
      const nextMap: Record<string, string> = {};
      previewRes.columns.forEach((column) => {
        const suggestedField = fields.find(
          (f) => previewRes.suggestedMapping?.[f.key] === column,
        );
        nextMap[column] = suggestedField?.key || '';
      });
      setColumnToField(nextMap);
      const groupCandidate =
        fields.find((f) => {
          const key = f.key.toLowerCase();
          const label = f.label.toLowerCase();
          return key === 'group' || key === 'group_name' || key.includes('group') || label.includes('груп');
        }) || null;
      if (groupCandidate) {
        const groups = Array.from(
          new Set(
            records.items
              .map((r) => String(r.values?.[groupCandidate.key] || '').trim())
              .filter(Boolean),
          ),
        ).sort((a, b) => a.localeCompare(b));
        setExistingGroups(groups);
        if (groups.length > 0) setTargetGroup(groups[0]);
      } else {
        setExistingGroups([]);
        setTargetGroup('');
      }
    } catch (e: any) {
      setMessage(e?.message || t('crm.workspace.import.previewError'));
    } finally {
      setLoading(false);
    }
  };

  const createFieldFromColumn = async (column: string) => {
    setCreatingForColumn(column);
    setMessage(null);
    try {
      const key = toFieldKey(column);
      const type = inferType(column);
      const payload: Parameters<typeof createCustomObjectField>[1] = {
        key,
        label: column.trim() || key,
        type,
      };
      if (type === 'status') {
        const uniques =
          preview?.uniqueValuesByColumn?.[column]?.filter((s) => s.trim()) ?? [];
        payload.options =
          uniques.length > 0
            ? statusOptionsFromFileValues(uniques)
            : DEFAULT_STATUS_FIELD_OPTIONS;
      }
      if (type === 'select') {
        payload.options = [
          { value: 'low', label: 'Low' },
          { value: 'normal', label: 'Normal' },
          { value: 'high', label: 'High' },
        ];
      }
      const created = await createCustomObjectField(objectId, payload);
      setFields((prev) => [...prev, created]);
      setColumnToField((prev) => ({ ...prev, [column]: created.key }));
      setMessage(t('crm.workspace.import.fieldCreated', { label: created.label, column }));
    } catch (e: any) {
      setMessage(e?.message || t('crm.workspace.import.createFieldError', { column }));
    } finally {
      setCreatingForColumn(null);
    }
  };

  const handleApply = async () => {
    if (!preview) return;
    setApplying(true);
    setMessage(null);
    setApplyErrors([]);
    try {
      const fieldMapping = Object.entries(columnToField).reduce<Record<string, string | null>>(
        (acc, [column, fieldKey]) => {
          if (fieldKey) acc[fieldKey] = column;
          return acc;
        },
        {},
      );
      const requiredFields = fields.filter((f) => f.isActive && f.required);
      const missingRequired: string[] = [];
      requiredFields.forEach((field) => {
        if (fieldMapping[field.key]) return;
        const fallbackColumn = pickBestColumnForField(field.key, field.label, preview.columns);
        if (fallbackColumn) {
          fieldMapping[field.key] = fallbackColumn;
        } else {
          missingRequired.push(`${field.label} (${field.key})`);
        }
      });
      if (missingRequired.length > 0) {
        setMessage(t('crm.workspace.import.mapRequired', { fields: missingRequired.join(', ') }));
        setApplying(false);
        return;
      }
      const res = await applyCustomObjectImport(objectId, {
        importId: preview.importId,
        fieldMapping,
        defaultValues:
          importGroupMode !== 'keep' && groupField && targetGroup.trim()
            ? { [groupField.key]: targetGroup.trim() }
            : undefined,
      });
      const emptySkips = res.skippedEmptyRows ?? 0;
      const parts = [
        t('crm.workspace.import.importedSummary', {
          created: res.created,
          updated: res.updated,
          skipped: res.skipped,
        }),
      ];
      if (res.skipped > 0 && emptySkips > 0) {
        parts.push(
          t('crm.workspace.import.skippedEmptyHint', { count: emptySkips }),
        );
      }
      setMessage(parts.join(' '));
      setApplyErrors(res.errors || []);
    } catch (e: any) {
      setMessage(e?.message || t('crm.workspace.import.applyFailed'));
    } finally {
      setApplying(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">{t('crm.workspace.import.title')}</h1>
          <button
            type="button"
            onClick={() => navigate(`/workspace/${objectId}/table`)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-sm"
          >
            {t('crm.workspace.import.backToTable')}
          </button>
        </div>

        {importTableKind === 'board' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 leading-relaxed">
            {t('crm.workspace.import.boardTableHint')}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-slate-900">
                {t('crm.workspace.import.areaIntegrationsTitle')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
                {t('crm.workspace.import.areaIntegrationsSubtitle')}
              </p>
              <Link
                to="/sales"
                className="mt-2 inline-flex text-sm font-medium text-lumiva-accent hover:underline"
              >
                {t('crm.workspace.import.wooOpenSales')}
              </Link>
            </div>
          </div>
          {channelImportLoading && (
            <div className="text-sm text-slate-500">{t('crm.workspace.common.loading')}</div>
          )}
          {!channelImportLoading && sharedAreaIssue === 'no_object_area' && (
            <p className="text-sm text-slate-600">{t('crm.workspace.import.wooNoWorkspaceArea')}</p>
          )}
          {!channelImportLoading && sharedAreaIssue === 'no_connection_bindings' && workspaceAreaIdForLink && (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">{t('crm.workspace.import.channelNoBindingsForArea')}</p>
              <Link
                to={`/workspace/areas/${workspaceAreaIdForLink}`}
                className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#222222] hover:bg-slate-50"
              >
                {t('crm.workspace.import.wooOpenAreaIntegrations')}
              </Link>
            </div>
          )}
          {!channelImportLoading &&
            sharedAreaIssue === null &&
            areaIntegrationBindings.length > 0 &&
            boundConnections.length === 0 &&
            marketingMetaRows.length === 0 &&
            marketingGaRows.length === 0 &&
            bindingsNeedingHub.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">{t('crm.workspace.import.boundIntegrationsStale')}</p>
              {workspaceAreaIdForLink && (
                <Link
                  to={`/workspace/areas/${workspaceAreaIdForLink}`}
                  className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#222222] hover:bg-slate-50"
                >
                  {t('crm.workspace.import.wooOpenAreaIntegrations')}
                </Link>
              )}
            </div>
          )}
          {!channelImportLoading &&
            sharedAreaIssue === null &&
            (boundConnections.length > 0 ||
              marketingMetaRows.length > 0 ||
              marketingGaRows.length > 0 ||
              bindingsNeedingHub.length > 0) && (
              <>
                <button
                  type="button"
                  onClick={() => setAreaChannelsModalOpen(true)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors hover:bg-slate-50"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-lumiva-accent/10 text-lumiva-accent">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-6 w-6"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="M9 12l2 2 4-4" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">
                      {t('crm.workspace.import.areaChannelsCompactTitle')}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {t('crm.workspace.import.areaChannelsCompactSubtitle', { count: areaChannelsCount })}
                    </div>
                  </div>
                  <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 shrink-0">
                    {t('crm.workspace.import.areaChannelsOpen')}
                  </span>
                </button>
                {areaChannelsModalOpen &&
                  createPortal(
                    <div className="fixed inset-0 z-[8500] flex items-center justify-center p-4 sm:p-6">
                      <button
                        type="button"
                        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
                        aria-label={t('crm.workspace.import.areaChannelsClose')}
                        onClick={() => setAreaChannelsModalOpen(false)}
                      />
                      <div
                        role="dialog"
                        aria-modal="true"
                        className="relative z-10 flex max-h-[min(90vh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                      >
                        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                          <h3 className="text-base font-semibold text-slate-900">
                            {t('crm.workspace.import.areaIntegrationsTitle')}
                          </h3>
                          <button
                            type="button"
                            onClick={() => setAreaChannelsModalOpen(false)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            aria-label={t('crm.workspace.import.areaChannelsClose')}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="h-5 w-5"
                            >
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="space-y-4 overflow-y-auto px-4 py-4">
                {bindingsNeedingHub.map((b) => (
                  <div
                    key={`need-hub-${b.id}`}
                    className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 space-y-2"
                  >
                    <div className="text-sm font-semibold text-amber-950">{b.label || b.catalogKey}</div>
                    <p className="text-sm text-amber-900/90">
                      {t('crm.workspace.import.bindingNeedsHubConnection', {
                        label: b.label || b.catalogKey,
                      })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to="/integrations-hub?tab=catalog"
                        className="inline-flex rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-950 hover:bg-amber-100/80"
                      >
                        {t('crm.workspace.import.openIntegrationsCatalog')}
                      </Link>
                      {workspaceAreaIdForLink && (
                        <Link
                          to={`/workspace/areas/${workspaceAreaIdForLink}`}
                          className="inline-flex rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-950 hover:bg-amber-100/80"
                        >
                          {t('crm.workspace.import.wooOpenAreaIntegrations')}
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
                {boundConnections.map((conn) => {
                  const mode = getWorkspaceTableImportMode(conn);
                  const st = { ...emptyChannelImport(), ...channelImportById[conn.id] };
                  if (!mode) {
                    return (
                      <div
                        key={conn.id}
                        className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3 space-y-2"
                      >
                        <div className="text-sm font-semibold text-slate-900">{conn.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {conn.kind}
                          {conn.linkCatalogId ? ` · ${conn.linkCatalogId}` : ''}
                        </div>
                        <p className="text-sm text-slate-600">
                          {t('crm.workspace.import.channelImportUnsupported')}
                        </p>
                        <Link
                          to="/integrations-hub?tab=connections"
                          className="inline-flex text-sm font-medium text-lumiva-accent hover:underline"
                        >
                          {t('crm.workspace.import.wooOpenIntegrations')}
                        </Link>
                      </div>
                    );
                  }
                  const isWoo = mode === 'woo';
                  const pr = st.preview;
                  return (
                    <div
                      key={conn.id}
                      className="rounded-xl border border-slate-200 bg-white p-3 space-y-3 shadow-sm"
                    >
                      <div className="text-sm font-semibold text-slate-900">{conn.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {conn.lastSyncAt
                          ? isWoo
                            ? t('crm.workspace.import.wooLastSync', {
                                date: new Date(conn.lastSyncAt).toLocaleString(),
                              })
                            : t('crm.workspace.import.metaLastSync', {
                                date: new Date(conn.lastSyncAt).toLocaleString(),
                              })
                          : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={st.previewLoading}
                          onClick={() => void loadChannelPreview(conn)}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-[#222222] hover:bg-slate-50 disabled:opacity-60"
                        >
                          {st.previewLoading
                            ? t('crm.workspace.common.loading')
                            : isWoo
                              ? t('crm.workspace.import.wooLoadPreview')
                              : t('crm.workspace.import.metaLoadPreview')}
                        </button>
                      </div>
                      {st.previewError && (
                        <p className="text-sm text-rose-600" role="alert">
                          {st.previewError}
                        </p>
                      )}
                      {pr && pr.sampleOrderCount === 0 && (
                        <p className="text-sm text-slate-600">
                          {isWoo
                            ? t('crm.workspace.import.wooPreviewEmpty')
                            : t('crm.workspace.import.metaPreviewEmpty')}
                        </p>
                      )}
                      {pr && pr.columns.length > 0 && (
                        <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                          <div className="text-sm font-medium text-slate-800">
                            {isWoo
                              ? t('crm.workspace.import.wooPreviewSample', { count: pr.sampleOrderCount })
                              : t('crm.workspace.import.metaPreviewSample', { count: pr.sampleOrderCount })}
                          </div>
                          <div className="overflow-x-auto max-w-full border border-slate-200 rounded-lg bg-white">
                            <table className="min-w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                  {pr.columns.slice(0, 16).map((col) => (
                                    <th
                                      key={col}
                                      className="text-left px-2 py-1.5 font-medium text-slate-700 whitespace-nowrap"
                                    >
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {pr.sampleRows.slice(0, 8).map((row, ri) => (
                                  <tr key={ri} className="border-b border-slate-100">
                                    {pr.columns.slice(0, 16).map((col) => (
                                      <td
                                        key={col}
                                        className="px-2 py-1.5 text-slate-600 max-w-[140px] truncate"
                                        title={row[col] || ''}
                                      >
                                        {row[col] || '—'}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="text-xs text-slate-500">
                            {isWoo
                              ? t('crm.workspace.import.wooPreviewMoreCols')
                              : t('crm.workspace.import.metaPreviewMoreCols')}
                          </div>
                          <ImportGranularityControls
                            channelKey={conn.id}
                            st={st}
                            mergeCh={mergeCh}
                          />
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-slate-800">
                              {isWoo
                                ? t('crm.workspace.import.wooStatusField')
                                : t('crm.workspace.import.metaStatusField')}
                            </div>
                            <select
                              value={st.statusFieldKey}
                              onChange={(e) =>
                                mergeCh(conn.id, { statusFieldKey: e.target.value })
                              }
                              className="max-w-md rounded-lg border border-slate-300 px-2 py-2 text-sm bg-white"
                            >
                              <option value="">{t('crm.workspace.import.wooStatusFieldNone')}</option>
                              {fields
                                .filter((f) => f.isActive)
                                .map((f) => (
                                  <option key={f.key} value={f.key}>
                                    {f.label} ({f.key}) — {f.type}
                                  </option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500">
                              {isWoo
                                ? t('crm.workspace.import.wooStatusFieldHint')
                                : t('crm.workspace.import.metaStatusFieldHint')}
                            </p>
                          </div>
                          <div className="text-sm font-medium text-slate-800 pt-2 border-t border-slate-200">
                            {isWoo
                              ? t('crm.workspace.import.wooColumnMapping')
                              : t('crm.workspace.import.metaColumnMapping')}
                          </div>
                          <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto pr-1">
                            {pr.columns.map((column) => (
                              <div key={column} className="flex flex-wrap items-center gap-2">
                                <label className="flex items-center gap-1.5 shrink-0 w-36">
                                  <input
                                    type="checkbox"
                                    checked={st.columnImport[column] !== false}
                                    onChange={(e) =>
                                      mergeCh(conn.id, {
                                        columnImport: {
                                          ...st.columnImport,
                                          [column]: e.target.checked,
                                        },
                                      })
                                    }
                                  />
                                  <span className="text-sm text-slate-700 truncate" title={column}>
                                    {column}
                                  </span>
                                </label>
                                <select
                                  value={st.columnToField[column] || ''}
                                  onChange={(e) =>
                                    mergeCh(conn.id, {
                                      columnToField: {
                                        ...st.columnToField,
                                        [column]: e.target.value,
                                      },
                                    })
                                  }
                                  disabled={st.columnImport[column] === false}
                                  className="flex-1 min-w-[160px] rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                                >
                                  <option value="">{t('crm.workspace.import.notMapped')}</option>
                                  {fieldOptions.map((field) => (
                                    <option key={field.value} value={field.value}>
                                      {field.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void createMappedFieldFromChannelColumn(
                                      conn.id,
                                      mode,
                                      column,
                                      st,
                                    )
                                  }
                                  disabled={
                                    st.creatingColumn === column || st.columnImport[column] === false
                                  }
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs hover:bg-slate-50 disabled:opacity-60"
                                >
                                  {st.creatingColumn === column
                                    ? t('crm.workspace.import.creatingField')
                                    : t('crm.workspace.import.createField')}
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            disabled={st.syncing}
                            onClick={() => void runChannelSync(conn, st)}
                            className="rounded-xl bg-[#222222] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
                          >
                            {st.syncing
                              ? isWoo
                                ? t('crm.workspace.import.wooSyncing')
                                : t('crm.workspace.import.metaSyncing')
                              : isWoo
                                ? t('crm.workspace.import.wooSyncWithMapping')
                                : t('crm.workspace.import.metaSyncWithMapping')}
                          </button>
                        </div>
                      )}
                      {st.message && (
                        <div className="text-sm text-slate-700">{st.message}</div>
                      )}
                      {st.wooSyncHintVisible && isWoo && (
                        <p className="text-xs text-slate-600 border-t border-slate-100 pt-2">
                          {t('crm.workspace.import.wooSyncDataInSalesNotInTable')}
                        </p>
                      )}
                    </div>
                  );
                })}
                {marketingMetaRows.map((mrow) => {
                  const chKey = marketingMetaChannelKey(mrow);
                  const st = { ...emptyChannelImport(), ...channelImportById[chKey] };
                  const pr = st.preview;
                  return (
                    <div
                      key={chKey}
                      className="rounded-xl border border-slate-200 bg-white p-3 space-y-3 shadow-sm"
                    >
                      <div className="text-sm font-semibold text-slate-900">{mrow.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {t('crm.workspace.import.metaFromMarketing')}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={st.previewLoading}
                          onClick={() => void loadMarketingMetaChannelPreview(mrow)}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-[#222222] hover:bg-slate-50 disabled:opacity-60"
                        >
                          {st.previewLoading
                            ? t('crm.workspace.common.loading')
                            : t('crm.workspace.import.metaLoadPreview')}
                        </button>
                      </div>
                      {st.previewError && (
                        <p className="text-sm text-rose-600" role="alert">
                          {st.previewError}
                        </p>
                      )}
                      {pr && pr.sampleOrderCount === 0 && (
                        <p className="text-sm text-slate-600">{t('crm.workspace.import.metaPreviewEmpty')}</p>
                      )}
                      {pr && pr.columns.length > 0 && (
                        <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                          <div className="text-sm font-medium text-slate-800">
                            {t('crm.workspace.import.metaPreviewSample', { count: pr.sampleOrderCount })}
                          </div>
                          <div className="overflow-x-auto max-w-full border border-slate-200 rounded-lg bg-white">
                            <table className="min-w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                  {pr.columns.slice(0, 16).map((col) => (
                                    <th
                                      key={col}
                                      className="text-left px-2 py-1.5 font-medium text-slate-700 whitespace-nowrap"
                                    >
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {pr.sampleRows.slice(0, 8).map((row, ri) => (
                                  <tr key={ri} className="border-b border-slate-100">
                                    {pr.columns.slice(0, 16).map((col) => (
                                      <td
                                        key={col}
                                        className="px-2 py-1.5 text-slate-600 max-w-[140px] truncate"
                                        title={row[col] || ''}
                                      >
                                        {row[col] || '—'}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="text-xs text-slate-500">{t('crm.workspace.import.metaPreviewMoreCols')}</div>
                          <ImportGranularityControls channelKey={chKey} st={st} mergeCh={mergeCh} />
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-slate-800">
                              {t('crm.workspace.import.metaStatusField')}
                            </div>
                            <select
                              value={st.statusFieldKey}
                              onChange={(e) =>
                                mergeCh(chKey, { statusFieldKey: e.target.value })
                              }
                              className="max-w-md rounded-lg border border-slate-300 px-2 py-2 text-sm bg-white"
                            >
                              <option value="">{t('crm.workspace.import.wooStatusFieldNone')}</option>
                              {fields
                                .filter((f) => f.isActive)
                                .map((f) => (
                                  <option key={f.key} value={f.key}>
                                    {f.label} ({f.key}) — {f.type}
                                  </option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500">
                              {t('crm.workspace.import.metaStatusFieldHint')}
                            </p>
                          </div>
                          <div className="text-sm font-medium text-slate-800 pt-2 border-t border-slate-200">
                            {t('crm.workspace.import.metaColumnMapping')}
                          </div>
                          <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto pr-1">
                            {pr.columns.map((column) => (
                              <div key={column} className="flex flex-wrap items-center gap-2">
                                <label className="flex items-center gap-1.5 shrink-0 w-36">
                                  <input
                                    type="checkbox"
                                    checked={st.columnImport[column] !== false}
                                    onChange={(e) =>
                                      mergeCh(chKey, {
                                        columnImport: {
                                          ...st.columnImport,
                                          [column]: e.target.checked,
                                        },
                                      })
                                    }
                                  />
                                  <span className="text-sm text-slate-700 truncate" title={column}>
                                    {column}
                                  </span>
                                </label>
                                <select
                                  value={st.columnToField[column] || ''}
                                  onChange={(e) =>
                                    mergeCh(chKey, {
                                      columnToField: {
                                        ...st.columnToField,
                                        [column]: e.target.value,
                                      },
                                    })
                                  }
                                  disabled={st.columnImport[column] === false}
                                  className="flex-1 min-w-[160px] rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                                >
                                  <option value="">{t('crm.workspace.import.notMapped')}</option>
                                  {fieldOptions.map((field) => (
                                    <option key={field.value} value={field.value}>
                                      {field.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void createMappedFieldFromChannelColumn(
                                      chKey,
                                      'meta_ads',
                                      column,
                                      st,
                                    )
                                  }
                                  disabled={
                                    st.creatingColumn === column || st.columnImport[column] === false
                                  }
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs hover:bg-slate-50 disabled:opacity-60"
                                >
                                  {st.creatingColumn === column
                                    ? t('crm.workspace.import.creatingField')
                                    : t('crm.workspace.import.createField')}
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            disabled={st.syncing}
                            onClick={() => void runMarketingMetaChannelSync(mrow, st)}
                            className="rounded-xl bg-[#222222] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
                          >
                            {st.syncing
                              ? t('crm.workspace.import.metaSyncing')
                              : t('crm.workspace.import.metaSyncWithMapping')}
                          </button>
                        </div>
                      )}
                      {st.message && <div className="text-sm text-slate-700">{st.message}</div>}
                    </div>
                  );
                })}
                {marketingGaRows.map((grow) => {
                  const chKey = marketingMetaChannelKey(grow);
                  const st = { ...emptyChannelImport(), ...channelImportById[chKey] };
                  const pr = st.preview;
                  return (
                    <div
                      key={chKey}
                      className="rounded-xl border border-slate-200 bg-white p-3 space-y-3 shadow-sm"
                    >
                      <div className="text-sm font-semibold text-slate-900">{grow.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {t('crm.workspace.import.gaFromMarketing')}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={st.previewLoading}
                          onClick={() => void loadMarketingGaChannelPreview(grow)}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-[#222222] hover:bg-slate-50 disabled:opacity-60"
                        >
                          {st.previewLoading
                            ? t('crm.workspace.common.loading')
                            : t('crm.workspace.import.gaLoadPreview')}
                        </button>
                      </div>
                      {st.previewError && (
                        <p className="text-sm text-rose-600" role="alert">
                          {st.previewError}
                        </p>
                      )}
                      {pr && pr.sampleOrderCount === 0 && (
                        <p className="text-sm text-slate-600">{t('crm.workspace.import.gaPreviewEmpty')}</p>
                      )}
                      {pr && pr.columns.length > 0 && (
                        <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                          <div className="text-sm font-medium text-slate-800">
                            {t('crm.workspace.import.metaPreviewSample', { count: pr.sampleOrderCount })}
                          </div>
                          <div className="overflow-x-auto max-w-full border border-slate-200 rounded-lg bg-white">
                            <table className="min-w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                  {pr.columns.slice(0, 16).map((col) => (
                                    <th
                                      key={col}
                                      className="text-left px-2 py-1.5 font-medium text-slate-700 whitespace-nowrap"
                                    >
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {pr.sampleRows.slice(0, 8).map((row, ri) => (
                                  <tr key={ri} className="border-b border-slate-100">
                                    {pr.columns.slice(0, 16).map((col) => (
                                      <td
                                        key={col}
                                        className="px-2 py-1.5 text-slate-600 max-w-[140px] truncate"
                                        title={row[col] || ''}
                                      >
                                        {row[col] || '—'}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="text-xs text-slate-500">{t('crm.workspace.import.metaPreviewMoreCols')}</div>
                          <ImportGranularityControls channelKey={chKey} st={st} mergeCh={mergeCh} />
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-slate-800">
                              {t('crm.workspace.import.metaStatusField')}
                            </div>
                            <select
                              value={st.statusFieldKey}
                              onChange={(e) =>
                                mergeCh(chKey, { statusFieldKey: e.target.value })
                              }
                              className="max-w-md rounded-lg border border-slate-300 px-2 py-2 text-sm bg-white"
                            >
                              <option value="">{t('crm.workspace.import.wooStatusFieldNone')}</option>
                              {fields
                                .filter((f) => f.isActive)
                                .map((f) => (
                                  <option key={f.key} value={f.key}>
                                    {f.label} ({f.key}) — {f.type}
                                  </option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500">
                              {t('crm.workspace.import.metaStatusFieldHint')}
                            </p>
                          </div>
                          <div className="text-sm font-medium text-slate-800 pt-2 border-t border-slate-200">
                            {t('crm.workspace.import.metaColumnMapping')}
                          </div>
                          <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto pr-1">
                            {pr.columns.map((column) => (
                              <div key={column} className="flex flex-wrap items-center gap-2">
                                <label className="flex items-center gap-1.5 shrink-0 w-36">
                                  <input
                                    type="checkbox"
                                    checked={st.columnImport[column] !== false}
                                    onChange={(e) =>
                                      mergeCh(chKey, {
                                        columnImport: {
                                          ...st.columnImport,
                                          [column]: e.target.checked,
                                        },
                                      })
                                    }
                                  />
                                  <span className="text-sm text-slate-700 truncate" title={column}>
                                    {column}
                                  </span>
                                </label>
                                <select
                                  value={st.columnToField[column] || ''}
                                  onChange={(e) =>
                                    mergeCh(chKey, {
                                      columnToField: {
                                        ...st.columnToField,
                                        [column]: e.target.value,
                                      },
                                    })
                                  }
                                  disabled={st.columnImport[column] === false}
                                  className="flex-1 min-w-[160px] rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                                >
                                  <option value="">{t('crm.workspace.import.notMapped')}</option>
                                  {fieldOptions.map((field) => (
                                    <option key={field.value} value={field.value}>
                                      {field.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void createMappedFieldFromChannelColumn(
                                      chKey,
                                      'ga4',
                                      column,
                                      st,
                                    )
                                  }
                                  disabled={
                                    st.creatingColumn === column || st.columnImport[column] === false
                                  }
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs hover:bg-slate-50 disabled:opacity-60"
                                >
                                  {st.creatingColumn === column
                                    ? t('crm.workspace.import.creatingField')
                                    : t('crm.workspace.import.createField')}
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            disabled={st.syncing}
                            onClick={() => void runMarketingGaChannelSync(grow, st)}
                            className="rounded-xl bg-[#222222] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
                          >
                            {st.syncing
                              ? t('crm.workspace.import.gaSyncing')
                              : t('crm.workspace.import.gaSyncWithMapping')}
                          </button>
                        </div>
                      )}
                      {st.message && <div className="text-sm text-slate-700">{st.message}</div>}
                    </div>
                  );
                })}
                        </div>
                      </div>
                    </div>,
                    document.body,
                  )}
              </>
            )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="workspace-import-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="sr-only"
            />
            <label
              htmlFor="workspace-import-file"
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-lumiva-accent bg-lumiva-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-lumiva-accent-soft hover:shadow-md"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="M7 10l5-5 5 5" />
                <path d="M12 5v12" />
              </svg>
              {t('crm.workspace.import.chooseFile')}
            </label>
            <div className="text-sm text-slate-600">
              {file ? file.name : t('crm.workspace.import.fileNotSelected')}
            </div>
          </div>
          <button
            type="button"
            onClick={handlePreview}
            disabled={!file || loading}
            className="px-3 py-2 rounded-lg bg-lumiva-accent text-white text-sm transition-colors hover:bg-lumiva-accent-soft disabled:opacity-60"
          >
            {loading ? t('crm.workspace.import.reading') : t('crm.workspace.import.preview')}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{t('crm.workspace.import.importViaApi')}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('crm.workspace.import.importViaApiHint')}
              </p>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-700">
              {t('crm.workspace.import.soon')}
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            POST <span className="font-mono">/public/custom-objects/:slug/ingest</span>
          </div>
          <div className="text-xs text-slate-500">
            {t('crm.workspace.import.apiSectionHint')}
          </div>
        </div>

        {preview && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="text-sm text-slate-700">
              {t('crm.workspace.import.columnsRows', {
                cols: preview.columns.length,
                rows: preview.totalRows,
              })}
            </div>
            {preview.headerRowNumber ? (
              <div className="text-xs text-slate-500">
                {t('crm.workspace.import.headerRow', { n: preview.headerRowNumber })}
              </div>
            ) : null}
            <div className="text-xs text-slate-500">
              {t('crm.workspace.import.mapped', {
                mapped: mappedCount,
                total: preview.columns.length,
              })}
            </div>
            {groupField && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="text-sm font-medium text-slate-700">{t('crm.workspace.import.importTargetGroup')}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={importGroupMode}
                    onChange={(e) => setImportGroupMode(e.target.value as 'keep' | 'existing' | 'new')}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="keep">{t('crm.workspace.import.groupKeep')}</option>
                    <option value="existing">{t('crm.workspace.import.groupExisting')}</option>
                    <option value="new">{t('crm.workspace.import.groupNew')}</option>
                  </select>
                  {importGroupMode === 'existing' && (
                    <select
                      value={targetGroup}
                      onChange={(e) => setTargetGroup(e.target.value)}
                      className="min-w-[220px] rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white"
                    >
                      {existingGroups.map((groupName) => (
                        <option key={groupName} value={groupName}>
                          {groupName}
                        </option>
                      ))}
                    </select>
                  )}
                  {importGroupMode === 'new' && (
                    <input
                      value={targetGroup}
                      onChange={(e) => setTargetGroup(e.target.value)}
                      placeholder={t('crm.workspace.import.newGroupName')}
                      className="min-w-[220px] rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white"
                    />
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2">
              {preview.columns.map((column) => (
                <div key={column} className="flex items-center gap-2">
                  <div className="w-48 text-sm text-slate-700">{column}</div>
                  <select
                    value={columnToField[column] || ''}
                    onChange={(e) =>
                      setColumnToField((prev) => ({
                        ...prev,
                        [column]: e.target.value,
                      }))
                    }
                    className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">{t('crm.workspace.import.notMapped')}</option>
                    {fieldOptions.map((field) => (
                      <option key={field.value} value={field.value}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void createFieldFromColumn(column)}
                    disabled={creatingForColumn === column}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs hover:bg-slate-50 disabled:opacity-60"
                  >
                    {creatingForColumn === column ? t('crm.workspace.import.creatingField') : t('crm.workspace.import.createField')}
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleApply}
              disabled={applying}
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-60"
            >
              {applying ? t('crm.workspace.import.applying') : t('crm.workspace.import.apply')}
            </button>
          </div>
        )}

        {message && <div className="text-sm text-slate-700">{message}</div>}
        {applyErrors.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
            <div className="text-sm font-medium text-amber-900">
              {t('crm.workspace.import.rowErrors', { count: applyErrors.length })}
            </div>
            <div className="max-h-64 overflow-auto space-y-1">
              {applyErrors.map((error, idx) => (
                <div
                  key={`${error.row}-${idx}`}
                  className="text-xs text-amber-900 rounded-lg border border-amber-200 bg-white px-2 py-1.5"
                >
                  Row {error.row}: {error.reason}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

