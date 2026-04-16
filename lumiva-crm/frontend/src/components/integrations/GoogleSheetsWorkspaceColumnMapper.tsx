import React, { useEffect, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { fetchCustomObjectFields, type CustomObjectField } from '../../api/customObjects';

type Props = {
  objectId: string;
  /** Заголовки колонок из первой строки листа (как в превью). */
  sheetHeaders: string[];
  columnMapJson: string;
  onChangeColumnMapJson: (json: string) => void;
  t: TFunction;
};

function parseMap(json: string): Record<string, string> {
  if (!json.trim()) return {};
  try {
    const o = JSON.parse(json) as unknown;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) out[k] = v.trim();
      else if (typeof v === 'number') out[k] = String(v);
    }
    return out;
  } catch {
    return {};
  }
}

export const GoogleSheetsWorkspaceColumnMapper: React.FC<Props> = ({
  objectId,
  sheetHeaders,
  columnMapJson,
  onChangeColumnMapJson,
  t,
}) => {
  const [fields, setFields] = useState<CustomObjectField[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!objectId.trim()) {
      setFields([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchCustomObjectFields(objectId.trim())
      .then((list) => {
        if (!cancelled) setFields(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setFields([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [objectId]);

  const map = useMemo(() => parseMap(columnMapJson), [columnMapJson]);

  const setHeaderTarget = (header: string, fieldKey: string) => {
    const next = { ...map };
    if (!fieldKey) delete next[header];
    else next[header] = fieldKey;
    const keys = Object.keys(next);
    if (!keys.length) {
      onChangeColumnMapJson('');
      return;
    }
    onChangeColumnMapJson(JSON.stringify(next, null, 0));
  };

  const headers = sheetHeaders.filter((h) => String(h ?? '').trim());

  if (!objectId.trim()) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
      <div className="text-[11px] font-semibold text-slate-800">
        {t('crm.automations.panel.integrations.connectGoogleSheetsWorkspaceColumnMapTitle')}
      </div>
      <p className="text-[10px] text-slate-500 leading-snug">
        {t('crm.automations.panel.integrations.connectGoogleSheetsWorkspaceColumnMapHint')}
      </p>
      {loading && (
        <p className="text-[10px] text-slate-500">{t('crm.automations.list.loading')}</p>
      )}
      {!loading && fields.length === 0 && (
        <p className="text-[10px] text-amber-800">{t('crm.automations.panel.integrations.connectGoogleSheetsWorkspaceColumnMapNoFields')}</p>
      )}
      {!loading && fields.length > 0 && headers.length === 0 && (
        <p className="text-[10px] text-slate-500">
          {t('crm.automations.panel.integrations.connectGoogleSheetsWorkspaceColumnMapNeedPreview')}
        </p>
      )}
      {!loading && fields.length > 0 && headers.length > 0 && (
        <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
          {headers.map((h) => (
            <div key={h} className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
              <div className="min-w-0 flex-1 truncate text-[10px] font-medium text-slate-700" title={h}>
                {h}
              </div>
              <select
                value={map[h] ?? ''}
                onChange={(e) => setHeaderTarget(h, e.target.value)}
                className="w-full shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] bg-white sm:max-w-[220px]"
              >
                <option value="">
                  {t('crm.automations.panel.integrations.connectGoogleSheetsWorkspaceColumnSkip')}
                </option>
                {fields.map((f) => (
                  <option key={f.id} value={f.key}>
                    {f.label} ({f.key})
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
