import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BlurModal } from './BlurModal';
import { IntegrationBrandIcon } from '../../pages/automations/IntegrationBrandIcon';
import { integrationCatalogName } from '../../pages/automations/integrationsCatalog';
import {
  fetchIntegration,
  previewGoogleSheetsIntegration,
  updateIntegration,
  type GoogleSheetsPreviewResult,
} from '../../api/integrations';
import { fetchCustomObjects, type CustomObject } from '../../api/customObjects';
import {
  normalizeGoogleSheetsSpreadsheetId,
  type GoogleSheetConnectImportTarget,
} from './IntegrationThirdPartyConnectModal';
import { GoogleSheetsWorkspaceColumnMapper } from './GoogleSheetsWorkspaceColumnMapper';

type Props = {
  open: boolean;
  connectionId: string;
  onClose: () => void;
  onSaved: () => void;
};

export const GoogleSheetsConnectionSettingsModal: React.FC<Props> = ({
  open,
  connectionId,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loadingConn, setLoadingConn] = useState(false);
  const [baseConfig, setBaseConfig] = useState<Record<string, unknown>>({});
  const [draft, setDraft] = useState({
    label: '',
    spreadsheetId: '',
    googleSheetTabName: 'Sheet1',
    googleSheetTargetKind: 'leads' as GoogleSheetConnectImportTarget,
    googleSheetWorkspaceObjectId: '',
    googleSheetHeaderRow: '1',
    googleSheetFirstDataRow: '',
    googleSheetLastDataRow: '',
    googleSheetDedupeBy: 'email' as 'email' | 'phone' | 'external_id',
    googleSheetExternalIdHeader: '',
    googleSheetColumnMapJson: '',
    googleSheetRowMode: 'range' as 'range' | 'selected',
    apiToken: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [workspaceObjects, setWorkspaceObjects] = useState<CustomObject[]>([]);
  const [workspaceObjectsLoading, setWorkspaceObjectsLoading] = useState(false);
  const [sheetPreview, setSheetPreview] = useState<GoogleSheetsPreviewResult | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [selectedSheetRows, setSelectedSheetRows] = useState<number[]>([]);

  const applyConfig = useCallback((cfg: Record<string, unknown>) => {
    const sync = (cfg.sync as Record<string, unknown> | undefined) || {};
    const sel = Array.isArray(sync.selectedDataRows)
      ? (sync.selectedDataRows as unknown[]).map((x) => Math.floor(Number(x))).filter((n) => Number.isFinite(n))
      : [];
    const tk = (sync.targetKind as string) || 'leads';
    setDraft({
      label: typeof cfg.label === 'string' ? cfg.label : '',
      spreadsheetId: typeof cfg.spreadsheetId === 'string' ? cfg.spreadsheetId : '',
      googleSheetTabName:
        typeof cfg.sheetTabName === 'string' && cfg.sheetTabName.trim()
          ? String(cfg.sheetTabName)
          : 'Sheet1',
      googleSheetTargetKind: (['workspace', 'projects', 'sales', 'leads'].includes(tk)
        ? tk
        : 'leads') as GoogleSheetConnectImportTarget,
      googleSheetWorkspaceObjectId:
        typeof sync.workspaceObjectId === 'string' ? sync.workspaceObjectId : '',
      googleSheetHeaderRow: String(sync.headerRow != null ? Number(sync.headerRow) || 1 : 1),
      googleSheetFirstDataRow:
        sync.firstDataRow != null && String(sync.firstDataRow).trim() !== ''
          ? String(sync.firstDataRow)
          : '',
      googleSheetLastDataRow:
        sync.lastDataRow != null && String(sync.lastDataRow).trim() !== ''
          ? String(sync.lastDataRow)
          : '',
      googleSheetDedupeBy:
        sync.dedupeBy === 'phone' || sync.dedupeBy === 'external_id'
          ? sync.dedupeBy
          : 'email',
      googleSheetExternalIdHeader:
        typeof sync.externalIdHeader === 'string' ? sync.externalIdHeader : '',
      googleSheetColumnMapJson:
        sync.columnMap && typeof sync.columnMap === 'object'
          ? JSON.stringify(sync.columnMap, null, 0)
          : '',
      googleSheetRowMode: sel.length > 0 ? 'selected' : 'range',
      apiToken: '',
    });
    setSelectedSheetRows(sel.length ? (sel as number[]) : []);
    setSheetPreview(null);
    setPreviewErr(null);
  }, []);

  useEffect(() => {
    if (!open || !connectionId) return;
    setLoadErr(null);
    setErr(null);
    setLoadingConn(true);
    void fetchIntegration(connectionId)
      .then((row) => {
        const cfg = (row.config as Record<string, unknown> | undefined) || {};
        if (String(cfg.catalogId) !== 'google_sheets') {
          setLoadErr(t('crm.integrationsHub.googleSheetsSettingsWrongType'));
          return;
        }
        setBaseConfig(cfg);
        applyConfig(cfg);
      })
      .catch((e: unknown) => {
        setLoadErr((e as Error)?.message || t('crm.integrationsHub.googleSheetsSettingsLoadError'));
      })
      .finally(() => setLoadingConn(false));
  }, [open, connectionId, applyConfig, t]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setWorkspaceObjectsLoading(true);
    void fetchCustomObjects()
      .then((list) => {
        if (!cancelled) setWorkspaceObjects(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setWorkspaceObjects([]);
      })
      .finally(() => {
        if (!cancelled) setWorkspaceObjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const loadSheetPreview = async () => {
    const sid = normalizeGoogleSheetsSpreadsheetId(draft.spreadsheetId);
    if (!sid || !/^[a-zA-Z0-9-_]{20,}$/.test(sid)) {
      setPreviewErr(t('crm.automations.panel.integrations.connectGoogleSheetsSpreadsheetInvalid'));
      return;
    }
    const tok = draft.apiToken.trim() || String(baseConfig.apiToken || '').trim();
    if (tok.length < 12) {
      setPreviewErr(t('crm.automations.panel.integrations.connectGoogleSheetsTokenShort'));
      return;
    }
    const headerRow = Math.max(1, parseInt(draft.googleSheetHeaderRow, 10) || 1);
    const firstDataRow = draft.googleSheetFirstDataRow.trim()
      ? Math.max(headerRow + 1, parseInt(draft.googleSheetFirstDataRow, 10) || headerRow + 1)
      : undefined;
    const lastDataRow = draft.googleSheetLastDataRow.trim()
      ? Math.max(headerRow + 1, parseInt(draft.googleSheetLastDataRow, 10) || headerRow + 1)
      : undefined;
    setPreviewBusy(true);
    setPreviewErr(null);
    try {
      const res = await previewGoogleSheetsIntegration({
        spreadsheetId: sid,
        apiToken: tok,
        sheetTabName: draft.googleSheetTabName.trim() || 'Sheet1',
        headerRow,
        firstDataRow,
        lastDataRow,
        maxPreviewRows: 50,
      });
      setSheetPreview(res);
      if (draft.googleSheetRowMode === 'selected') {
        setSelectedSheetRows(res.rows.map((r) => r.rowNumber));
      }
    } catch (e: unknown) {
      setSheetPreview(null);
      setSelectedSheetRows([]);
      setPreviewErr((e as Error)?.message || t('crm.automations.panel.integrations.connectError'));
    } finally {
      setPreviewBusy(false);
    }
  };

  const submit = async () => {
    const sid = normalizeGoogleSheetsSpreadsheetId(draft.spreadsheetId);
    if (!sid) {
      setErr(t('crm.automations.panel.integrations.connectGoogleSheetsSpreadsheetRequired'));
      return;
    }
    if (!/^[a-zA-Z0-9-_]{20,}$/.test(sid)) {
      setErr(t('crm.automations.panel.integrations.connectGoogleSheetsSpreadsheetInvalid'));
      return;
    }
    const tokenOut = draft.apiToken.trim() || String(baseConfig.apiToken || '').trim();
    if (tokenOut.length < 12) {
      setErr(t('crm.automations.panel.integrations.connectGoogleSheetsTokenShort'));
      return;
    }
    if (draft.googleSheetTargetKind === 'workspace' && !draft.googleSheetWorkspaceObjectId.trim()) {
      setErr(t('crm.automations.panel.integrations.connectGoogleSheetsWorkspaceObjectRequired'));
      return;
    }
    const headerRow = Math.max(1, parseInt(draft.googleSheetHeaderRow, 10) || 1);
    const firstDataRowParsed = draft.googleSheetFirstDataRow.trim()
      ? Math.max(headerRow + 1, parseInt(draft.googleSheetFirstDataRow, 10) || headerRow + 1)
      : null;
    const lastDataRowParsed = draft.googleSheetLastDataRow.trim()
      ? Math.max(headerRow + 1, parseInt(draft.googleSheetLastDataRow, 10) || headerRow + 1)
      : null;
    if (
      firstDataRowParsed !== null &&
      lastDataRowParsed !== null &&
      lastDataRowParsed < firstDataRowParsed
    ) {
      setErr(t('crm.automations.panel.integrations.connectGoogleSheetsRowRangeInvalid'));
      return;
    }
    const mapRaw = draft.googleSheetColumnMapJson.trim();
    if (mapRaw) {
      try {
        const parsed = JSON.parse(mapRaw) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setErr(t('crm.automations.panel.integrations.connectGoogleSheetsColumnMapJsonInvalid'));
          return;
        }
        const badValue = Object.values(parsed as Record<string, unknown>).some(
          (v) => typeof v !== 'string' && typeof v !== 'number',
        );
        if (badValue) {
          setErr(t('crm.automations.panel.integrations.connectGoogleSheetsColumnMapJsonInvalid'));
          return;
        }
      } catch {
        setErr(t('crm.automations.panel.integrations.connectGoogleSheetsColumnMapJsonInvalid'));
        return;
      }
    }
    if (draft.googleSheetRowMode === 'selected' && !selectedSheetRows.length) {
      setErr(t('crm.automations.panel.integrations.connectGoogleSheetsNoRowsSelected'));
      return;
    }

    const headerRowGs = headerRow;
    const firstDataRowGs = draft.googleSheetFirstDataRow.trim()
      ? Math.max(
          headerRowGs + 1,
          parseInt(draft.googleSheetFirstDataRow, 10) || headerRowGs + 1,
        )
      : undefined;
    const lastDataRowGs = draft.googleSheetLastDataRow.trim()
      ? Math.max(
          headerRowGs + 1,
          parseInt(draft.googleSheetLastDataRow, 10) || headerRowGs + 1,
        )
      : undefined;
    let columnMapGs: Record<string, string> | undefined;
    if (mapRaw) {
      const parsed = JSON.parse(mapRaw) as Record<string, unknown>;
      columnMapGs = {};
      for (const [k, v] of Object.entries(parsed)) {
        columnMapGs[k] = String(v);
      }
    }

    const nextConfig: Record<string, unknown> = {
      ...baseConfig,
      catalogId: 'google_sheets',
      label: draft.label.trim() || undefined,
      spreadsheetId: sid,
      sheetTabName: draft.googleSheetTabName.trim() || 'Sheet1',
      apiToken: tokenOut,
      sync: {
        targetKind: draft.googleSheetTargetKind,
        headerRow: headerRowGs,
        ...(firstDataRowGs !== undefined ? { firstDataRow: firstDataRowGs } : {}),
        ...(lastDataRowGs !== undefined ? { lastDataRow: lastDataRowGs } : {}),
        ...(draft.googleSheetTargetKind === 'workspace' && draft.googleSheetWorkspaceObjectId.trim()
          ? { workspaceObjectId: draft.googleSheetWorkspaceObjectId.trim() }
          : {}),
        ...(draft.googleSheetTargetKind === 'leads'
          ? {
              dedupeBy: draft.googleSheetDedupeBy,
              ...(draft.googleSheetDedupeBy === 'external_id' &&
              draft.googleSheetExternalIdHeader.trim()
                ? { externalIdHeader: draft.googleSheetExternalIdHeader.trim() }
                : {}),
            }
          : {}),
        ...(columnMapGs ? { columnMap: columnMapGs } : {}),
        ...(draft.googleSheetRowMode === 'selected' && selectedSheetRows.length
          ? { selectedDataRows: [...selectedSheetRows].sort((a, b) => a - b) }
          : {}),
      },
    };
    if (draft.googleSheetRowMode === 'range') {
      const s = nextConfig.sync as Record<string, unknown>;
      delete s.selectedDataRows;
    }

    setBusy(true);
    setErr(null);
    try {
      await updateIntegration(connectionId, { config: nextConfig });
      onSaved();
      onClose();
    } catch (e: unknown) {
      setErr((e as Error)?.message || t('crm.automations.panel.integrations.connectError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BlurModal open size="lg" onClose={() => !busy && !loadingConn && onClose()}>
      <div className="max-h-[min(86vh,820px)] overflow-y-auto overscroll-contain p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <IntegrationBrandIcon
            catalogId="google_sheets"
            label={integrationCatalogName('google_sheets', t)}
            size={44}
          />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {t('crm.integrationsHub.googleSheetsSettingsTitle')}
            </h3>
            <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">
              {t('crm.integrationsHub.googleSheetsSettingsIntro')}
            </p>
          </div>
        </div>

        {loadErr && (
          <p className="mt-3 text-[11px] text-rose-600">{loadErr}</p>
        )}
        {loadingConn && !loadErr && (
          <p className="mt-3 text-xs text-slate-500">{t('crm.automations.list.loading')}</p>
        )}

        {!loadingConn && !loadErr && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-[11px] text-slate-600">
                {t('crm.automations.panel.integrations.connectLabelField')}
              </label>
              <input
                value={draft.label}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-600">
                {t('crm.automations.panel.integrations.connectGoogleSheetsSpreadsheetId')}
              </label>
              <input
                value={draft.spreadsheetId}
                onChange={(e) => setDraft((d) => ({ ...d, spreadsheetId: e.target.value }))}
                onBlur={() =>
                  setDraft((d) => ({
                    ...d,
                    spreadsheetId: normalizeGoogleSheetsSpreadsheetId(d.spreadsheetId),
                  }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-600">
                {t('crm.automations.panel.integrations.connectGoogleSheetsTabName')}
              </label>
              <input
                value={draft.googleSheetTabName}
                onChange={(e) => setDraft((d) => ({ ...d, googleSheetTabName: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-600">
                {t('crm.automations.panel.integrations.connectGoogleSheetsImportTarget')}
              </label>
              <select
                value={draft.googleSheetTargetKind}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    googleSheetTargetKind: e.target.value as GoogleSheetConnectImportTarget,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white"
              >
                <option value="leads">
                  {t('crm.automations.panel.integrations.connectGoogleSheetsImportTargetLeads')}
                </option>
                <option value="workspace">
                  {t(
                    'crm.automations.panel.integrations.connectGoogleSheetsImportTargetWorkspace',
                  )}
                </option>
                <option value="projects">
                  {t(
                    'crm.automations.panel.integrations.connectGoogleSheetsImportTargetProjects',
                  )}
                </option>
                <option value="sales">
                  {t('crm.automations.panel.integrations.connectGoogleSheetsImportTargetSales')}
                </option>
              </select>
              <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                {t('crm.automations.panel.integrations.connectGoogleSheetsImportTargetHint')}
              </p>
            </div>
            {draft.googleSheetTargetKind === 'workspace' && (
              <div>
                <label className="mb-1 block text-[11px] text-slate-600">
                  {t('crm.automations.panel.integrations.connectGoogleSheetsWorkspaceObject')}
                </label>
                <select
                  value={draft.googleSheetWorkspaceObjectId}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, googleSheetWorkspaceObjectId: e.target.value }))
                  }
                  disabled={workspaceObjectsLoading}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white disabled:opacity-60"
                >
                  <option value="">
                    {workspaceObjectsLoading
                      ? '…'
                      : t(
                          'crm.automations.panel.integrations.connectGoogleSheetsWorkspaceObjectPlaceholder',
                        )}
                  </option>
                  {workspaceObjects.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-600">
                  {t('crm.automations.panel.integrations.connectGoogleSheetsHeaderRow')}
                </label>
                <input
                  type="number"
                  min={1}
                  value={draft.googleSheetHeaderRow}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, googleSheetHeaderRow: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-600">
                  {t('crm.automations.panel.integrations.connectGoogleSheetsFirstDataRow')}
                </label>
                <input
                  type="number"
                  min={2}
                  value={draft.googleSheetFirstDataRow}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, googleSheetFirstDataRow: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-600">
                  {t('crm.automations.panel.integrations.connectGoogleSheetsLastDataRow')}
                </label>
                <input
                  type="number"
                  min={2}
                  value={draft.googleSheetLastDataRow}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, googleSheetLastDataRow: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
            </div>
            {draft.googleSheetTargetKind === 'leads' && (
              <>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-600">
                    {t('crm.automations.panel.integrations.connectGoogleSheetsDedupeBy')}
                  </label>
                  <select
                    value={draft.googleSheetDedupeBy}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        googleSheetDedupeBy: e.target.value as
                          | 'email'
                          | 'phone'
                          | 'external_id',
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white"
                  >
                    <option value="email">
                      {t('crm.automations.panel.integrations.connectGoogleSheetsDedupeEmail')}
                    </option>
                    <option value="phone">
                      {t('crm.automations.panel.integrations.connectGoogleSheetsDedupePhone')}
                    </option>
                    <option value="external_id">
                      {t(
                        'crm.automations.panel.integrations.connectGoogleSheetsDedupeExternalId',
                      )}
                    </option>
                  </select>
                </div>
                {draft.googleSheetDedupeBy === 'external_id' && (
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-600">
                      {t('crm.automations.panel.integrations.connectGoogleSheetsExternalIdHeader')}
                    </label>
                    <input
                      value={draft.googleSheetExternalIdHeader}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          googleSheetExternalIdHeader: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    />
                  </div>
                )}
              </>
            )}
            <div>
              <label className="mb-1 block text-[11px] text-slate-600">
                {t('crm.automations.panel.integrations.connectGoogleSheetsColumnMapJson')}
              </label>
              <textarea
                value={draft.googleSheetColumnMapJson}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, googleSheetColumnMapJson: e.target.value }))
                }
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-600">
                {t('crm.automations.panel.integrations.connectToken')}
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={draft.apiToken}
                onChange={(e) => setDraft((d) => ({ ...d, apiToken: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono"
                placeholder={t('crm.integrationsHub.googleSheetsTokenKeepPlaceholder')}
              />
              <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                {t('crm.automations.panel.integrations.connectGoogleSheetsTokenHint')}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-600">
                  {t('crm.automations.panel.integrations.connectGoogleSheetsRowMode')}
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-800">
                    <input
                      type="radio"
                      name="gs-edit-row-mode"
                      checked={draft.googleSheetRowMode === 'range'}
                      onChange={() => setDraft((d) => ({ ...d, googleSheetRowMode: 'range' }))}
                      className="rounded-full border-slate-300"
                    />
                    {t('crm.automations.panel.integrations.connectGoogleSheetsRowModeRange')}
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-800">
                    <input
                      type="radio"
                      name="gs-edit-row-mode"
                      checked={draft.googleSheetRowMode === 'selected'}
                      onChange={() => setDraft((d) => ({ ...d, googleSheetRowMode: 'selected' }))}
                      className="rounded-full border-slate-300"
                    />
                    {t('crm.automations.panel.integrations.connectGoogleSheetsRowModeSelected')}
                  </label>
                </div>
                <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                  {t('crm.automations.panel.integrations.connectGoogleSheetsRowModeHint')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={previewBusy || busy}
                  onClick={() => void loadSheetPreview()}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  {previewBusy
                    ? t('crm.automations.panel.integrations.connectGoogleSheetsPreviewLoading')
                    : t('crm.automations.panel.integrations.connectGoogleSheetsPreviewLoad')}
                </button>
                {sheetPreview && draft.googleSheetRowMode === 'selected' && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setSelectedSheetRows(sheetPreview.rows.map((r) => r.rowNumber))
                      }
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] text-slate-700 hover:bg-white"
                    >
                      {t('crm.automations.panel.integrations.connectGoogleSheetsSelectAllRows')}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setSelectedSheetRows([])}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] text-slate-700 hover:bg-white"
                    >
                      {t('crm.automations.panel.integrations.connectGoogleSheetsClearRows')}
                    </button>
                  </>
                )}
                {sheetPreview && draft.googleSheetRowMode === 'range' && (
                  <span className="text-[10px] text-slate-500">
                    {t('crm.automations.panel.integrations.connectGoogleSheetsPreviewReadonlyHint')}
                  </span>
                )}
              </div>
              {previewErr && <p className="text-[11px] text-rose-600">{previewErr}</p>}
              {sheetPreview && (
                <p className="text-[10px] text-slate-500">
                  {t('crm.automations.panel.integrations.connectGoogleSheetsPreviewRangeHint', {
                    from: sheetPreview.previewFromRow,
                    to: sheetPreview.previewToRow,
                  })}
                </p>
              )}
              {sheetPreview && (
                <div className="max-h-52 overflow-auto rounded-lg border border-slate-200 bg-white">
                  <table className="min-w-full border-collapse text-left text-[10px]">
                    <thead className="sticky top-0 z-[1] bg-slate-100 text-slate-600">
                      <tr>
                        {draft.googleSheetRowMode === 'selected' && (
                          <th className="w-8 border-b border-slate-200 px-1 py-1.5" />
                        )}
                        <th className="border-b border-slate-200 px-2 py-1.5 whitespace-nowrap">
                          {t(
                            'crm.automations.panel.integrations.connectGoogleSheetsPreviewColRow',
                          )}
                        </th>
                        {sheetPreview.headers.map((h, i) => (
                          <th
                            key={i}
                            className="border-b border-slate-200 px-2 py-1.5 font-medium whitespace-nowrap max-w-[120px] truncate"
                            title={h}
                          >
                            {h || '—'}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sheetPreview.rows.map((r) => {
                        const checked = selectedSheetRows.includes(r.rowNumber);
                        const sel = draft.googleSheetRowMode === 'selected';
                        return (
                          <tr key={r.rowNumber} className={sel && !checked ? 'bg-slate-50/90' : ''}>
                            {sel && (
                              <td className="border-b border-slate-100 px-1 py-1 align-middle">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={busy}
                                  onChange={() =>
                                    setSelectedSheetRows((prev) =>
                                      prev.includes(r.rowNumber)
                                        ? prev.filter((x) => x !== r.rowNumber)
                                        : [...prev, r.rowNumber].sort((a, b) => a - b),
                                    )
                                  }
                                  className="rounded border-slate-300"
                                />
                              </td>
                            )}
                            <td className="border-b border-slate-100 px-2 py-1 font-mono whitespace-nowrap text-slate-600">
                              {r.rowNumber}
                            </td>
                            {sheetPreview.headers.map((_, ci) => (
                              <td
                                key={ci}
                                className="max-w-[120px] truncate border-b border-slate-100 px-2 py-1 text-slate-800"
                                title={r.cells[ci] ?? ''}
                              >
                                {r.cells[ci] ?? ''}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {draft.googleSheetTargetKind === 'workspace' &&
                draft.googleSheetWorkspaceObjectId.trim() && (
                  <div className="pt-2">
                    <GoogleSheetsWorkspaceColumnMapper
                      objectId={draft.googleSheetWorkspaceObjectId.trim()}
                      sheetHeaders={sheetPreview?.headers ?? []}
                      columnMapJson={draft.googleSheetColumnMapJson}
                      onChangeColumnMapJson={(json) =>
                        setDraft((d) => ({ ...d, googleSheetColumnMapJson: json }))
                      }
                      t={t}
                    />
                  </div>
                )}
            </div>

            {err && <p className="text-[11px] text-rose-600">{err}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => onClose()}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                {t('crm.automations.panel.integrations.connectCancel')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="rounded-full bg-[#222222] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy ? t('crm.automations.list.loading') : t('crm.integrationsHub.googleSheetsSettingsSave')}
              </button>
            </div>
          </div>
        )}
      </div>
    </BlurModal>
  );
};
