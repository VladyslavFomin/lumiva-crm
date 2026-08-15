import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BlurModal } from './BlurModal';
import { IntegrationBrandIcon } from '../../pages/automations/IntegrationBrandIcon';
import { integrationCatalogName } from '../../pages/automations/integrationsCatalog';
import {
  createIntegration,
  previewGoogleSheetsIntegration,
  testIntegration,
  type GoogleSheetsPreviewResult,
} from '../../api/integrations';
import { fetchCustomObjects, type CustomObject } from '../../api/customObjects';
import { GoogleSheetsWorkspaceColumnMapper } from './GoogleSheetsWorkspaceColumnMapper';
import {
  WordpressCf7ConnectGuide,
  generateCf7Secret,
} from './WordpressCf7ConnectGuide';
import { GoogleCalendarOAuthHubModal } from './GoogleCalendarOAuthHubModal';
import { OutlookCalendarOAuthHubModal } from './OutlookCalendarOAuthHubModal';

export type GoogleSheetConnectImportTarget = 'leads' | 'workspace' | 'projects' | 'sales';

const HIDE_WEBHOOK_FIELD = new Set([
  'mailchimp',
  'meta_ads',
  'wordpress_cf7',
  'google_sheets',
  'lumiva_client_cabinet',
  'lumiva_online_chat',
]);

const HIDE_API_TOKEN_FIELD = new Set([
  'wordpress_cf7',
  'lumiva_client_cabinet',
  'lumiva_online_chat',
]);

const THIRD_PARTY_IDS = new Set([
  'slack',
  'ms_teams',
  'google_calendar',
  'outlook',
  'whatsapp',
  'bitrix',
  'amocrm',
  'hubspot',
  'zapier',
  'make',
  'google_ads',
  'meta_ads',
  'mailchimp',
  '1c',
  'sap',
  'jira',
  'openai',
  'wordpress_cf7',
  'google_sheets',
  'lumiva_client_cabinet',
  'lumiva_online_chat',
  'iyzico',
  'paytr',
  'yookassa',
]);

export function isHubThirdPartyConnectCatalogId(id: string): boolean {
  return THIRD_PARTY_IDS.has(id);
}

/** ID из поля ввода или полной ссылки вида …/spreadsheets/d/…/… */
export function normalizeGoogleSheetsSpreadsheetId(raw: string): string {
  let s = raw.trim();
  const first = s.split(/\r?\n/)[0]?.trim();
  if (first) s = first;
  const fromDocs = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (fromDocs) return fromDocs[1];
  return s;
}

type Props = {
  open: boolean;
  catalogId: string;
  onClose: () => void;
  onCreated: () => void;
};

export const IntegrationThirdPartyConnectModal: React.FC<Props> = ({
  open,
  catalogId,
  onClose,
  onCreated,
}) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState({
    label: '',
    webhookUrl: '',
    apiToken: '',
    accountEmail: '',
    phoneNumberId: '',
    calendarId: '',
    developerToken: '',
    webhookVerifyToken: '',
    amoWebhookSecret: '',
    webhookInboundSecret: '',
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
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [workspaceObjects, setWorkspaceObjects] = useState<CustomObject[]>([]);
  const [workspaceObjectsLoading, setWorkspaceObjectsLoading] = useState(false);
  const [sheetPreview, setSheetPreview] = useState<GoogleSheetsPreviewResult | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [selectedSheetRows, setSelectedSheetRows] = useState<number[]>([]);
  const [wpCf7Done, setWpCf7Done] = useState<{
    pasteUrl: string;
    baseUrl: string;
    name: string;
    wizardIngestUrl: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setWpCf7Done(null);
    setDraft({
      label: '',
      webhookUrl: '',
      apiToken: '',
      accountEmail: '',
      phoneNumberId: '',
      calendarId: '',
      developerToken: '',
      webhookVerifyToken: '',
      amoWebhookSecret: '',
      webhookInboundSecret: '',
      spreadsheetId: '',
      googleSheetTabName: 'Sheet1',
      googleSheetTargetKind: 'leads',
      googleSheetWorkspaceObjectId: '',
      googleSheetHeaderRow: '1',
      googleSheetFirstDataRow: '',
      googleSheetLastDataRow: '',
      googleSheetDedupeBy: 'email',
      googleSheetExternalIdHeader: '',
      googleSheetColumnMapJson: '',
      googleSheetRowMode: 'range',
    });
    setErr(null);
    setWorkspaceObjects([]);
    setSheetPreview(null);
    setPreviewErr(null);
    setSelectedSheetRows([]);
  }, [open, catalogId]);

  useEffect(() => {
    if (!open || catalogId !== 'wordpress_cf7') return;
    setDraft((d) => {
      if (d.webhookInboundSecret.trim()) return d;
      return { ...d, webhookInboundSecret: generateCf7Secret() };
    });
  }, [open, catalogId]);

  useEffect(() => {
    if (!open || catalogId !== 'google_sheets') return;
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
  }, [open, catalogId]);

  if (!open || !isHubThirdPartyConnectCatalogId(catalogId)) return null;

  if (catalogId === 'google_calendar') {
    return (
      <GoogleCalendarOAuthHubModal open={open} onClose={onClose} />
    );
  }

  if (catalogId === 'outlook') {
    return (
      <OutlookCalendarOAuthHubModal open={open} onClose={onClose} />
    );
  }

  const loadSheetPreview = async () => {
    if (catalogId !== 'google_sheets') return;
    const sid = normalizeGoogleSheetsSpreadsheetId(draft.spreadsheetId);
    if (!sid || !/^[a-zA-Z0-9-_]{20,}$/.test(sid)) {
      setPreviewErr(t('crm.automations.panel.integrations.connectGoogleSheetsSpreadsheetInvalid'));
      return;
    }
    if (draft.apiToken.trim().length < 12) {
      setPreviewErr(t('crm.automations.panel.integrations.connectGoogleSheetsTokenShort'));
      return;
    }
    const headerRow = Math.max(1, parseInt(draft.googleSheetHeaderRow, 10) || 1);
    const firstDataRow = draft.googleSheetFirstDataRow.trim()
      ? Math.max(
          headerRow + 1,
          parseInt(draft.googleSheetFirstDataRow, 10) || headerRow + 1,
        )
      : undefined;
    const lastDataRow = draft.googleSheetLastDataRow.trim()
      ? Math.max(
          headerRow + 1,
          parseInt(draft.googleSheetLastDataRow, 10) || headerRow + 1,
        )
      : undefined;
    setPreviewBusy(true);
    setPreviewErr(null);
    try {
      const res = await previewGoogleSheetsIntegration({
        spreadsheetId: sid,
        apiToken: draft.apiToken.trim(),
        sheetTabName: draft.googleSheetTabName.trim() || 'Sheet1',
        headerRow,
        firstDataRow,
        lastDataRow,
        maxPreviewRows: 50,
      });
      setSheetPreview(res);
      setSelectedSheetRows(res.rows.map((r) => r.rowNumber));
    } catch (e: unknown) {
      setSheetPreview(null);
      setSelectedSheetRows([]);
      setPreviewErr((e as Error)?.message || t('crm.automations.panel.integrations.connectError'));
    } finally {
      setPreviewBusy(false);
    }
  };

  const submit = async () => {
    if (catalogId === 'mailchimp' && draft.apiToken.trim().length < 12) {
      setErr(t('crm.automations.panel.integrations.connectMailchimpTokenShort'));
      return;
    }
    if (catalogId === 'wordpress_cf7') {
      const sec = draft.webhookInboundSecret.trim();
      if (sec.length > 0 && sec.length < 6) {
        setErr(t('crm.automations.panel.integrations.connectWordpressCf7SecretShort'));
        return;
      }
    }
    if (catalogId === 'google_sheets') {
      const sid = normalizeGoogleSheetsSpreadsheetId(draft.spreadsheetId);
      if (!sid) {
        setErr(t('crm.automations.panel.integrations.connectGoogleSheetsSpreadsheetRequired'));
        return;
      }
      if (!/^[a-zA-Z0-9-_]{20,}$/.test(sid)) {
        setErr(t('crm.automations.panel.integrations.connectGoogleSheetsSpreadsheetInvalid'));
        return;
      }
      if (draft.apiToken.trim().length < 12) {
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
    }
    setBusy(true);
    setErr(null);
    try {
      const catalogTitle = integrationCatalogName(catalogId, t);
      const name =
        draft.label.trim() ||
        `${catalogTitle} — ${t('crm.automations.panel.integrations.connectDefaultSuffix')}`;
      const sheetIdNorm =
        catalogId === 'google_sheets' ? normalizeGoogleSheetsSpreadsheetId(draft.spreadsheetId) : '';
      const headerRowGs = Math.max(1, parseInt(draft.googleSheetHeaderRow, 10) || 1);
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
      const mapTrim = draft.googleSheetColumnMapJson.trim();
      let columnMapGs: Record<string, string> | undefined;
      if (mapTrim) {
        const parsed = JSON.parse(mapTrim) as Record<string, unknown>;
        columnMapGs = {};
        for (const [k, v] of Object.entries(parsed)) {
          columnMapGs[k] = String(v);
        }
      }
      const created = await createIntegration({
        name,
        kind: 'third_party_link',
        description: catalogTitle,
        config: {
          catalogId,
          label: draft.label.trim() || undefined,
          webhookUrl: draft.webhookUrl.trim() || undefined,
          apiToken: draft.apiToken.trim() || undefined,
          accountEmail: draft.accountEmail.trim() || undefined,
          phoneNumberId: draft.phoneNumberId.trim() || undefined,
          calendarId: draft.calendarId.trim() || undefined,
          developerToken: draft.developerToken.trim() || undefined,
          webhookVerifyToken: draft.webhookVerifyToken.trim() || undefined,
          ...(catalogId === 'amocrm'
            ? { amoWebhookSecret: draft.amoWebhookSecret.trim() || undefined }
            : {}),
          ...(catalogId === 'wordpress_cf7'
            ? { webhookInboundSecret: draft.webhookInboundSecret.trim() || undefined }
            : {}),
          ...(catalogId === 'google_sheets'
            ? {
                spreadsheetId: sheetIdNorm,
                sheetTabName: draft.googleSheetTabName.trim() || 'Sheet1',
                sync: {
                  targetKind: draft.googleSheetTargetKind,
                  headerRow: headerRowGs,
                  ...(firstDataRowGs !== undefined ? { firstDataRow: firstDataRowGs } : {}),
                  ...(lastDataRowGs !== undefined ? { lastDataRow: lastDataRowGs } : {}),
                  ...(draft.googleSheetTargetKind === 'workspace' &&
                  draft.googleSheetWorkspaceObjectId.trim()
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
                    ? {
                        selectedDataRows: [...selectedSheetRows].sort((a, b) => a - b),
                      }
                    : {}),
                },
              }
            : {}),
        },
      });
      await testIntegration(created.id).catch(() => {});
      if (catalogId === 'wordpress_cf7') {
        const paste = (
          created.siteFormInboundWebhookPasteUrl ||
          created.siteFormInboundWebhookUrl ||
          ''
        ).trim();
        setWpCf7Done({
          pasteUrl: paste,
          baseUrl: (created.siteFormInboundWebhookUrl || '').trim(),
          name: created.name,
          wizardIngestUrl: (created.lumivaWizardCf7IngestUrl || '').trim(),
        });
        return;
      }
      onCreated();
      onClose();
    } catch (e: unknown) {
      setErr((e as Error)?.message || t('crm.automations.panel.integrations.connectError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BlurModal
      open
      size={catalogId === 'google_sheets' || catalogId === 'wordpress_cf7' ? 'lg' : 'md'}
      onClose={() => {
        if (busy) return;
        if (wpCf7Done) onCreated();
        onClose();
      }}
    >
      <div className="max-h-[min(82vh,760px)] overflow-y-auto overscroll-contain p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <IntegrationBrandIcon
            catalogId={catalogId}
            label={integrationCatalogName(catalogId, t)}
            size={44}
          />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {t('crm.automations.panel.integrations.connectTitle', {
                name: integrationCatalogName(catalogId, t),
              })}
            </h3>
            <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">
              {catalogId === 'mailchimp'
                ? t('crm.automations.panel.integrations.connectMailchimpIntro')
                : catalogId === 'wordpress_cf7'
                  ? t('crm.automations.panel.integrations.connectWordpressCf7IntroShort')
                  : catalogId === 'lumiva_client_cabinet' ||
                      catalogId === 'lumiva_online_chat'
                    ? t('crm.automations.panel.integrations.connectLumivaWizardAddonIntro')
                  : catalogId === 'google_sheets'
                    ? t('crm.automations.panel.integrations.connectGoogleSheetsIntro')
                    : t('crm.automations.panel.integrations.connectIntro')}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {wpCf7Done ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
              <div className="text-sm font-semibold text-emerald-950">
                {t('crm.automations.panel.integrations.connectWordpressCf7SuccessTitle')}
              </div>
              <p className="text-[11px] text-slate-700 leading-relaxed">
                {t('crm.automations.panel.integrations.connectWordpressCf7SuccessBody')}
              </p>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  {t('crm.automations.panel.integrations.connectWordpressCf7PasteUrlLabel')}
                </div>
                <code className="block max-h-28 overflow-auto break-all rounded-lg border border-slate-200 bg-white px-2 py-2 text-[10px] text-slate-800">
                  {wpCf7Done.pasteUrl || t('crm.automations.panel.integrations.siteFormInboundUrlMissingEnv')}
                </code>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!wpCf7Done.pasteUrl}
                    onClick={() =>
                      void navigator.clipboard.writeText(wpCf7Done.pasteUrl).catch(() => {})
                    }
                    className="rounded-full bg-[#222222] px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-40"
                  >
                    {t('crm.automations.panel.integrations.connectWordpressCf7CopyPasteUrl')}
                  </button>
                  {wpCf7Done.baseUrl && wpCf7Done.baseUrl !== wpCf7Done.pasteUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        void navigator.clipboard.writeText(wpCf7Done.baseUrl).catch(() => {})
                      }
                      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      {t('crm.automations.panel.integrations.connectWordpressCf7CopyBaseUrl')}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-slate-600 leading-snug">
                {t('crm.automations.panel.integrations.connectWordpressCf7SuccessWpSteps')}
              </p>
              {wpCf7Done.wizardIngestUrl ? (
                <div className="border-t border-emerald-200/80 pt-3 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-900">
                    {t('crm.automations.panel.integrations.connectWordpressCf7WizardTitle')}
                  </div>
                  <p className="text-[10px] text-slate-700 leading-snug">
                    {t('crm.automations.panel.integrations.connectWordpressCf7WizardBody')}
                  </p>
                  <code className="block max-h-20 overflow-auto break-all rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[9px] text-slate-800">
                    {wpCf7Done.wizardIngestUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() =>
                      void navigator.clipboard.writeText(wpCf7Done.wizardIngestUrl).catch(() => {})
                    }
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    {t('crm.automations.panel.integrations.connectWordpressCf7WizardCopyUrl')}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
          {catalogId !== 'wordpress_cf7' && (
          <div>
            <label className="mb-1 block text-[11px] text-slate-600">
              {t('crm.automations.panel.integrations.connectLabelField')}
            </label>
            <input
              value={draft.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              placeholder={integrationCatalogName(catalogId, t)}
            />
          </div>
          )}
          {!HIDE_WEBHOOK_FIELD.has(catalogId) && (
            <div>
              <label className="mb-1 block text-[11px] text-slate-600">
                {t('crm.automations.panel.integrations.connectWebhook')}
              </label>
              <input
                value={draft.webhookUrl}
                onChange={(e) => setDraft((d) => ({ ...d, webhookUrl: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono"
                placeholder="https://…"
              />
              {catalogId === 'bitrix' && (
                <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                  {t('crm.automations.panel.integrations.connectBitrixWebhookHint')}
                </p>
              )}
              {catalogId === 'amocrm' && (
                <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                  {t('crm.automations.panel.integrations.connectAmocrmHint')}
                </p>
              )}
              {catalogId === 'hubspot' && (
                <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                  {t('crm.automations.panel.integrations.connectHubspotHint')}
                </p>
              )}
              {catalogId === 'google_ads' && (
                <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                  {t('crm.automations.panel.integrations.connectGoogleAdsCustomerHint')}
                </p>
              )}
              {catalogId === 'meta_ads' && (
                <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                  {t('crm.automations.panel.integrations.connectMetaAdsHint')}
                </p>
              )}
            </div>
          )}
          {catalogId === 'wordpress_cf7' && (
            <WordpressCf7ConnectGuide
              label={draft.label}
              onLabelChange={(v) => setDraft((d) => ({ ...d, label: v }))}
              catalogPlaceholder={integrationCatalogName(catalogId, t)}
              secret={draft.webhookInboundSecret}
              onSecretChange={(v) => setDraft((d) => ({ ...d, webhookInboundSecret: v }))}
              onRegenerateSecret={() =>
                setDraft((d) => ({ ...d, webhookInboundSecret: generateCf7Secret() }))
              }
              onClearSecret={() => setDraft((d) => ({ ...d, webhookInboundSecret: '' }))}
              t={t}
            />
          )}
          {catalogId === 'google_sheets' && (
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
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
              />
              <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                {t('crm.automations.panel.integrations.connectGoogleSheetsSpreadsheetIdHint')}
              </p>
            </div>
          )}
          {catalogId === 'google_sheets' && (
            <>
              <div>
                <label className="mb-1 block text-[11px] text-slate-600">
                  {t('crm.automations.panel.integrations.connectGoogleSheetsTabName')}
                </label>
                <input
                  value={draft.googleSheetTabName}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, googleSheetTabName: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  placeholder="Sheet1"
                />
                <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                  {t('crm.automations.panel.integrations.connectGoogleSheetsTabNameHint')}
                </p>
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
                      setDraft((d) => ({
                        ...d,
                        googleSheetWorkspaceObjectId: e.target.value,
                      }))
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
                  <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                    {t('crm.automations.panel.integrations.connectGoogleSheetsWorkspaceObjectHint')}
                  </p>
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
                  <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                    {t('crm.automations.panel.integrations.connectGoogleSheetsHeaderRowHint')}
                  </p>
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
                    placeholder=""
                  />
                  <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                    {t('crm.automations.panel.integrations.connectGoogleSheetsFirstDataRowHint')}
                  </p>
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
                    placeholder=""
                  />
                  <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                    {t('crm.automations.panel.integrations.connectGoogleSheetsLastDataRowHint')}
                  </p>
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
                        placeholder="ID"
                      />
                      <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                        {t(
                          'crm.automations.panel.integrations.connectGoogleSheetsExternalIdHeaderHint',
                        )}
                      </p>
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
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono"
                  placeholder='{"Email":"email","Phone":"phone"}'
                />
                <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                  {t('crm.automations.panel.integrations.connectGoogleSheetsColumnMapJsonHint')}
                </p>
              </div>
            </>
          )}
          {!HIDE_API_TOKEN_FIELD.has(catalogId) && (
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
              />
              {catalogId === 'mailchimp' && (
                <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                  {t('crm.automations.panel.integrations.connectMailchimpTokenHint')}
                </p>
              )}
              {catalogId === 'google_sheets' && (
                <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                  {t('crm.automations.panel.integrations.connectGoogleSheetsTokenHint')}
                </p>
              )}
            </div>
          )}
          {catalogId === 'google_sheets' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-600">
                  {t('crm.automations.panel.integrations.connectGoogleSheetsRowMode')}
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-800">
                    <input
                      type="radio"
                      name="gs-row-mode"
                      checked={draft.googleSheetRowMode === 'range'}
                      onChange={() =>
                        setDraft((d) => ({
                          ...d,
                          googleSheetRowMode: 'range',
                        }))
                      }
                      className="rounded-full border-slate-300"
                    />
                    {t('crm.automations.panel.integrations.connectGoogleSheetsRowModeRange')}
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-800">
                    <input
                      type="radio"
                      name="gs-row-mode"
                      checked={draft.googleSheetRowMode === 'selected'}
                      onChange={() =>
                        setDraft((d) => ({
                          ...d,
                          googleSheetRowMode: 'selected',
                        }))
                      }
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
              {previewErr && (
                <p className="text-[11px] text-rose-600">{previewErr}</p>
              )}
              {sheetPreview && (
                <p className="text-[10px] text-slate-500">
                  {t('crm.automations.panel.integrations.connectGoogleSheetsPreviewRangeHint', {
                    from: sheetPreview.previewFromRow,
                    to: sheetPreview.previewToRow,
                  })}
                </p>
              )}
              {sheetPreview && (
                <div className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white">
                  <table className="min-w-full border-collapse text-left text-[10px]">
                    <thead className="sticky top-0 z-[1] bg-slate-100 text-slate-600">
                      <tr>
                        {draft.googleSheetRowMode === 'selected' && (
                          <th className="w-8 border-b border-slate-200 px-1 py-1.5" />
                        )}
                        <th className="border-b border-slate-200 px-2 py-1.5 whitespace-nowrap">
                          {t('crm.automations.panel.integrations.connectGoogleSheetsPreviewColRow')}
                        </th>
                        {sheetPreview.headers.map((h, i) => (
                          <th
                            key={i}
                            className="border-b border-slate-200 px-2 py-1.5 font-medium whitespace-nowrap max-w-[140px] truncate"
                            title={h}
                          >
                            {h || `—`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sheetPreview.rows.map((r) => {
                        const checked = selectedSheetRows.includes(r.rowNumber);
                        const sel = draft.googleSheetRowMode === 'selected';
                        return (
                          <tr
                            key={r.rowNumber}
                            className={
                              sel
                                ? checked
                                  ? 'bg-white'
                                  : 'bg-slate-50/90 opacity-80'
                                : 'bg-white'
                            }
                          >
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
                            <td className="border-b border-slate-100 px-2 py-1 font-mono text-slate-600 whitespace-nowrap">
                              {r.rowNumber}
                            </td>
                            {sheetPreview.headers.map((_, ci) => (
                              <td
                                key={ci}
                                className="border-b border-slate-100 px-2 py-1 text-slate-800 max-w-[140px] truncate"
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
          )}
          {catalogId === 'google_ads' && (
            <div>
              <label className="mb-1 block text-[11px] text-slate-600">
                {t('crm.automations.panel.integrations.connectGoogleAdsDeveloperToken')}
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={draft.developerToken}
                onChange={(e) => setDraft((d) => ({ ...d, developerToken: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono"
              />
            </div>
          )}
          {catalogId !== 'mailchimp' &&
            catalogId !== 'google_sheets' &&
            catalogId !== 'wordpress_cf7' &&
            catalogId !== 'lumiva_client_cabinet' &&
            catalogId !== 'lumiva_online_chat' && (
              <div>
                <label className="mb-1 block text-[11px] text-slate-600">
                  {t('crm.automations.panel.integrations.connectEmail')}
                </label>
                <input
                  type="email"
                  value={draft.accountEmail}
                  onChange={(e) => setDraft((d) => ({ ...d, accountEmail: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
            )}
          {catalogId === 'whatsapp' && (
            <div>
              <label className="mb-1 block text-[11px] text-slate-600">
                {t('crm.automations.panel.integrations.connectPhoneNumberId')}
              </label>
              <input
                value={draft.phoneNumberId}
                onChange={(e) => setDraft((d) => ({ ...d, phoneNumberId: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono"
                placeholder="123456789012345"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                {t('crm.automations.panel.integrations.connectPhoneNumberIdHint')}
              </p>
              <div className="mt-3">
                <label className="mb-1 block text-[11px] text-slate-600">
                  {t('crm.automations.panel.integrations.connectWhatsappVerifyToken')}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={draft.webhookVerifyToken}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, webhookVerifyToken: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono"
                  placeholder="lumiva-wa-secret-…"
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  {t('crm.automations.panel.integrations.connectWhatsappVerifyTokenHint')}
                </p>
              </div>
            </div>
          )}
          {catalogId === 'amocrm' && (
            <div>
              <label className="mb-1 block text-[11px] text-slate-600">
                {t('crm.automations.panel.integrations.connectAmocrmWebhookSecret')}
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={draft.amoWebhookSecret}
                onChange={(e) => setDraft((d) => ({ ...d, amoWebhookSecret: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono"
                placeholder="••••••••"
              />
              <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                {t('crm.automations.panel.integrations.connectAmocrmWebhookSecretHint')}
              </p>
            </div>
          )}
            {err && <p className="text-[11px] text-rose-600">{err}</p>}
            </>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (wpCf7Done) onCreated();
                onClose();
              }}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
            >
              {wpCf7Done
                ? t('crm.automations.panel.integrations.connectWordpressCf7CloseWithoutCopy')
                : t('crm.automations.panel.integrations.connectCancel')}
            </button>
            {wpCf7Done ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onCreated();
                  onClose();
                }}
                className="rounded-full bg-[#222222] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {t('crm.automations.panel.integrations.connectWordpressCf7DoneButton')}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="rounded-full bg-[#222222] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy ? t('crm.automations.list.loading') : t('crm.automations.panel.integrations.connectSubmit')}
              </button>
            )}
          </div>
        </div>
      </div>
    </BlurModal>
  );
};
