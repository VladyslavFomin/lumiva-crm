import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchCustomObjectFields,
  pushRecordsToBoard,
  type CustomObject,
  type CustomObjectField,
} from '../../api/customObjects';
import { getWorkspaceTableKind } from '../../workspace/workspaceTableKind';

const MAP_AUTO = '__auto__';
const MAP_OMIT = '__omit__';

type Props = {
  open: boolean;
  onClose: () => void;
  sourceObjectId: string;
  workspaceAreaId: string | null | undefined;
  areaObjects: CustomObject[];
  recordIds: string[];
  sourceFields: CustomObjectField[];
  onSuccess: () => void;
};

export const PushToBoardModal: React.FC<Props> = ({
  open,
  onClose,
  sourceObjectId,
  workspaceAreaId,
  areaObjects,
  recordIds,
  sourceFields,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const boards = useMemo(
    () =>
      areaObjects.filter(
        (o) => o.id !== sourceObjectId && getWorkspaceTableKind(o.meta) === 'board',
      ),
    [areaObjects, sourceObjectId],
  );

  const [targetId, setTargetId] = useState('');
  const [targetFields, setTargetFields] = useState<CustomObjectField[]>([]);
  /** targetFieldKey → источник: авто / не копировать / ключ поля источника */
  const [perTargetSource, setPerTargetSource] = useState<Record<string, string>>({});
  const [mapExpanded, setMapExpanded] = useState(true);
  const [dupField, setDupField] = useState('');
  const [skipDup, setSkipDup] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!targetId) {
      setTargetFields([]);
      return;
    }
    let cancelled = false;
    void fetchCustomObjectFields(targetId)
      .then((fields) => {
        if (!cancelled) setTargetFields(fields.filter((f) => f.isActive));
      })
      .catch(() => {
        if (!cancelled) setTargetFields([]);
      });
    return () => {
      cancelled = true;
    };
  }, [targetId]);

  useEffect(() => {
    if (!targetFields.length) {
      setPerTargetSource({});
      return;
    }
    setPerTargetSource(() => {
      const next: Record<string, string> = {};
      for (const tf of targetFields) {
        next[tf.key] = MAP_AUTO;
      }
      return next;
    });
  }, [targetId, targetFields]);

  const sourceTakenByOther = (sourceKey: string, forTargetKey: string) => {
    for (const tf of targetFields) {
      if (tf.key === forTargetKey) continue;
      const c = perTargetSource[tf.key] ?? MAP_AUTO;
      if (c !== MAP_AUTO && c !== MAP_OMIT && c === sourceKey) return true;
    }
    return false;
  };

  const matchedKeysCount = useMemo(() => {
    const tk = new Set(targetFields.map((f) => f.key));
    return sourceFields.filter((s) => tk.has(s.key)).length;
  }, [sourceFields, targetFields]);

  const explicitPairsCount = useMemo(() => {
    let n = 0;
    for (const tf of targetFields) {
      const c = perTargetSource[tf.key] ?? MAP_AUTO;
      if (c !== MAP_AUTO && c !== MAP_OMIT && c !== tf.key) n += 1;
    }
    return n;
  }, [targetFields, perTargetSource]);

  const buildPayload = () => {
    const fieldMap: Record<string, string> = {};
    const omitAutoTargetKeys: string[] = [];
    for (const tf of targetFields) {
      const ch = perTargetSource[tf.key] ?? MAP_AUTO;
      if (ch === MAP_OMIT) {
        omitAutoTargetKeys.push(tf.key);
        continue;
      }
      if (ch === MAP_AUTO) continue;
      fieldMap[ch] = tf.key;
    }
    return {
      fieldMap: Object.keys(fieldMap).length ? fieldMap : undefined,
      omitAutoTargetKeys: omitAutoTargetKeys.length ? omitAutoTargetKeys : undefined,
    };
  };

  if (!open) return null;

  const run = async () => {
    if (!targetId || !recordIds.length) return;
    setBusy(true);
    setErr(null);
    setSummary(null);
    try {
      const extra = buildPayload();
      const res = await pushRecordsToBoard(sourceObjectId, {
        targetObjectId: targetId,
        recordIds,
        ...extra,
        duplicateKeyTargetField: dupField.trim() ? dupField.trim() : null,
        skipDuplicates: skipDup,
      });
      const parts: string[] = [];
      parts.push(t('crm.workspace.pushToBoard.created', { count: res.created.length }));
      if (res.skipped.length) {
        parts.push(t('crm.workspace.pushToBoard.skipped', { count: res.skipped.length }));
      }
      if (res.errors.length) {
        parts.push(t('crm.workspace.pushToBoard.errors', { count: res.errors.length }));
      }
      setSummary(parts.join(' · '));
      onSuccess();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {t('crm.workspace.pushToBoard.title')}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{t('crm.workspace.pushToBoard.subtitle')}</p>
        </div>

        {!workspaceAreaId ? (
          <p className="text-sm text-amber-700">{t('crm.workspace.pushToBoard.noArea')}</p>
        ) : boards.length === 0 ? (
          <p className="text-sm text-amber-700">{t('crm.workspace.pushToBoard.noBoards')}</p>
        ) : (
          <>
            <label className="block text-xs font-medium text-slate-600">
              {t('crm.workspace.pushToBoard.targetTable')}
              <select
                value={targetId}
                onChange={(e) => {
                  setTargetId(e.target.value);
                  setDupField('');
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">{t('crm.workspace.pushToBoard.pickBoard')}</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>

            <p className="text-[11px] text-slate-500">
              {t('crm.workspace.pushToBoard.autoMapHint', { count: matchedKeysCount })}
              {explicitPairsCount > 0
                ? ` ${t('crm.workspace.pushToBoard.explicitMapHint', { count: explicitPairsCount })}`
                : ''}
            </p>

            {!!targetFields.length && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/80">
                <button
                  type="button"
                  onClick={() => setMapExpanded((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-800"
                >
                  <span>{t('crm.workspace.pushToBoard.fieldMapSection')}</span>
                  <span className="text-slate-400">{mapExpanded ? '▼' : '▶'}</span>
                </button>
                {mapExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-slate-200">
                    <p className="text-[11px] text-slate-500 pt-2">
                      {t('crm.workspace.pushToBoard.fieldMapHelp')}
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                            <th className="px-2 py-2 font-medium">{t('crm.workspace.pushToBoard.colTarget')}</th>
                            <th className="px-2 py-2 font-medium">{t('crm.workspace.pushToBoard.colSource')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {targetFields.map((tf) => {
                            const val = perTargetSource[tf.key] ?? MAP_AUTO;
                            return (
                              <tr key={tf.id} className="border-b border-slate-100 last:border-0">
                                <td className="px-2 py-1.5 text-slate-800 align-middle">
                                  <span className="font-medium">{tf.label}</span>
                                  <span className="text-slate-400 ml-1">({tf.key})</span>
                                </td>
                                <td className="px-2 py-1.5 align-middle">
                                  <select
                                    value={val}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setPerTargetSource((prev) => ({ ...prev, [tf.key]: v }));
                                    }}
                                    className="w-full min-w-[200px] rounded-md border border-slate-300 px-2 py-1 text-xs bg-white"
                                  >
                                    <option value={MAP_AUTO}>{t('crm.workspace.pushToBoard.mapAuto')}</option>
                                    <option value={MAP_OMIT}>{t('crm.workspace.pushToBoard.mapOmit')}</option>
                                    {sourceFields.map((sf) => {
                                      const taken = sourceTakenByOther(sf.key, tf.key);
                                      return (
                                        <option
                                          key={sf.id}
                                          value={sf.key}
                                          disabled={taken && val !== sf.key}
                                        >
                                          {sf.label} ({sf.key})
                                          {taken && val !== sf.key ? ` — ${t('crm.workspace.pushToBoard.sourceBusy')}` : ''}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <label className="block text-xs font-medium text-slate-600">
              {t('crm.workspace.pushToBoard.dupFieldTarget')}
              <select
                value={dupField}
                onChange={(e) => setDupField(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">{t('crm.workspace.pushToBoard.dupFieldNone')}</option>
                {targetFields.map((f) => (
                  <option key={f.id} value={f.key}>
                    {f.label} ({f.key})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={skipDup}
                onChange={(e) => setSkipDup(e.target.checked)}
                className="rounded border-slate-300"
              />
              {t('crm.workspace.pushToBoard.skipDup')}
            </label>
          </>
        )}

        {err && <p className="text-sm text-rose-600">{err}</p>}
        {summary && <p className="text-sm text-emerald-700">{summary}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
          >
            {t('crm.common.cancel')}
          </button>
          <button
            type="button"
            disabled={busy || !targetId || !recordIds.length || !boards.length}
            onClick={() => void run()}
            className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
          >
            {busy ? t('crm.workspace.pushToBoard.running') : t('crm.workspace.pushToBoard.submit')}
          </button>
        </div>
      </div>
    </div>
  );
};
