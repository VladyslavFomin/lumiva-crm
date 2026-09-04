import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../../pages/workspace/WorkspaceArea.css';
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
    <div className="ws-page ws-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ws-drawer">
        <div className="ws-drawer-head">
          <div>
            <h2>{t('crm.workspace.pushToBoard.title')}</h2>
            <div className="s">{t('crm.workspace.pushToBoard.subtitle')}</div>
          </div>
        </div>

        <div className="ws-drawer-body">
          {!workspaceAreaId ? (
            <p className="ws-note">{t('crm.workspace.pushToBoard.noArea')}</p>
          ) : boards.length === 0 ? (
            <p className="ws-note">{t('crm.workspace.pushToBoard.noBoards')}</p>
          ) : (
            <>
              <label className="ws-field">
                <label>{t('crm.workspace.pushToBoard.targetTable')}</label>
                <select
                  value={targetId}
                  onChange={(e) => {
                    setTargetId(e.target.value);
                    setDupField('');
                  }}
                  className="ws-input"
                >
                  <option value="">{t('crm.workspace.pushToBoard.pickBoard')}</option>
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>

              <p className="ws-note">
                {t('crm.workspace.pushToBoard.autoMapHint', { count: matchedKeysCount })}
                {explicitPairsCount > 0
                  ? ` ${t('crm.workspace.pushToBoard.explicitMapHint', { count: explicitPairsCount })}`
                  : ''}
              </p>

              {!!targetFields.length && (
                <div className="ws-sec">
                  <button
                    type="button"
                    onClick={() => setMapExpanded((v) => !v)}
                    className="ws-sec-head"
                    style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <h2 style={{ flex: 1 }}>{t('crm.workspace.pushToBoard.fieldMapSection')}</h2>
                    <span className="s">{mapExpanded ? '▼' : '▶'}</span>
                  </button>
                  {mapExpanded && (
                    <div className="ws-sec-body">
                      <p className="ws-note" style={{ marginBottom: 8 }}>
                        {t('crm.workspace.pushToBoard.fieldMapHelp')}
                      </p>
                      {targetFields.map((tf) => {
                        const val = perTargetSource[tf.key] ?? MAP_AUTO;
                        return (
                          <div className="ws-maprow" key={tf.id}>
                            <div className="tgt">
                              {tf.label}
                              <span className="key">({tf.key})</span>
                            </div>
                            <span className="ar">→</span>
                            <select
                              value={val}
                              onChange={(e) => {
                                const v = e.target.value;
                                setPerTargetSource((prev) => ({ ...prev, [tf.key]: v }));
                              }}
                              className="ws-input"
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
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <label className="ws-field">
                <label>{t('crm.workspace.pushToBoard.dupFieldTarget')}</label>
                <select
                  value={dupField}
                  onChange={(e) => setDupField(e.target.value)}
                  className="ws-input"
                >
                  <option value="">{t('crm.workspace.pushToBoard.dupFieldNone')}</option>
                  {targetFields.map((f) => (
                    <option key={f.id} value={f.key}>
                      {f.label} ({f.key})
                    </option>
                  ))}
                </select>
              </label>
              <label className="ws-check">
                <input
                  type="checkbox"
                  checked={skipDup}
                  onChange={(e) => setSkipDup(e.target.checked)}
                />
                {t('crm.workspace.pushToBoard.skipDup')}
              </label>
            </>
          )}

          {err && <p className="ws-note" style={{ color: '#9c2338' }}>{err}</p>}
          {summary && <p className="ws-note" style={{ color: '#1f8a5e' }}>{summary}</p>}
        </div>

        <div className="ws-drawer-foot">
          <span className="sp" />
          <button type="button" onClick={onClose} className="btn btn-sm">
            {t('crm.common.cancel')}
          </button>
          <button
            type="button"
            disabled={busy || !targetId || !recordIds.length || !boards.length}
            onClick={() => void run()}
            className="btn btn-primary btn-sm"
          >
            {busy ? t('crm.workspace.pushToBoard.running') : t('crm.workspace.pushToBoard.submit')}
          </button>
        </div>
      </div>
    </div>
  );
};
