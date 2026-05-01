import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchCustomObjects,
  fetchCustomObjectFields,
  fetchCustomObjectRecords,
  createCustomObjectRecord,
  type CustomObject,
  type CustomObjectField,
  type CustomObjectRecord,
} from '../../api/customObjects';
import { WorkspaceViewTabs } from '../../components/workspace/WorkspaceViewTabs';
import { useWorkspaceViewAccess } from '../../workspace/useWorkspaceViewAccess';
import { getWorkspaceTableKind } from '../../workspace/workspaceTableKind';
import { parseToLocalYMD, type LocalYMD } from '../../utils/calendarLocalDates';

const BAR_COLORS = [
  'linear-gradient(90deg,#93c5fd,#60a5fa)',
  'linear-gradient(90deg,#86efac,#4ade80)',
  'linear-gradient(90deg,#fcd34d,#fb923c)',
  'linear-gradient(90deg,#c4b5fd,#a78bfa)',
  'linear-gradient(90deg,#f9a8d4,#ec4899)',
];

function ymdToTime(p: LocalYMD): number {
  return new Date(p.y, p.m - 1, p.d).getTime();
}

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export const WorkspaceGanttViewPage: React.FC = () => {
  const { t } = useTranslation();
  const { objectId = '' } = useParams();
  useWorkspaceViewAccess(objectId, 'gantt');
  const [fields, setFields] = useState<CustomObjectField[]>([]);
  const [objectMeta, setObjectMeta] = useState<CustomObject['meta'] | null>(null);
  const [records, setRecords] = useState<CustomObjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [anchor, setAnchor] = useState(() => startOfWeekMonday(new Date()));
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newRecordName, setNewRecordName] = useState('');
  const [creatingRecord, setCreatingRecord] = useState(false);

  useEffect(() => {
    if (!objectId) return;
    setLoading(true);
    Promise.all([fetchCustomObjectFields(objectId), fetchCustomObjects().catch(() => [] as CustomObject[])])
      .then(async ([loadedFields, objects]) => {
        const object = objects.find((item) => item.id === objectId);
        const enrich =
          getWorkspaceTableKind(object?.meta as Record<string, unknown> | null) === 'board';
        const res = await fetchCustomObjectRecords(objectId, undefined, {
          enrichColumnBindings: enrich,
        });
        setFields(loadedFields.filter((f) => f.isActive));
        setRecords(res.items);
        setObjectMeta((object?.meta as Record<string, any> | null) || null);
      })
      .finally(() => setLoading(false));
  }, [objectId]);

  const cardTitleField = useMemo(() => {
    const saved = String((objectMeta as Record<string, any> | null)?.kanban?.cardTitleField || '').trim();
    if (saved) return saved;
    return (
      fields.find((f) => f.key === 'name')?.key ||
      fields.find((f) => f.key === 'title')?.key ||
      ''
    );
  }, [fields, objectMeta]);

  const dateKeys = useMemo(
    () => fields.filter((f) => f.type === 'date' || f.type === 'datetime').map((f) => f.key),
    [fields],
  );

  const resolveFieldText = (record: CustomObjectRecord, key: string) => {
    if (!key) return '';
    const raw = record.values?.[key];
    if (raw === undefined || raw === null) return '';
    return String(raw).trim();
  };

  const resolveTitle = (record: CustomObjectRecord) =>
    resolveFieldText(record, cardTitleField) ||
    String(record.values?.name || record.values?.title || record.id);

  const range = useMemo(() => {
    const start = new Date(anchor);
    const days = 21;
    const end = new Date(start);
    end.setDate(end.getDate() + days - 1);
    const dayMs = 86400000;
    const labels: Array<{ t: number; label: string }> = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      labels.push({
        t: d.getTime(),
        label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
      });
    }
    return { startMs: start.getTime(), endMs: end.getTime() + dayMs - 1, labels, dayMs, days };
  }, [anchor]);

  const todayMs = useMemo(() => {
    const n = new Date();
    n.setHours(0, 0, 0, 0);
    return n.getTime();
  }, [anchor]);

  type RowBar = {
    record: CustomObjectRecord;
    title: string;
    leftPct: number;
    widthPct: number;
    bg: string;
  };

  const rows = useMemo(() => {
    const span = Math.max(1, range.endMs - range.startMs);
    const out: RowBar[] = [];
    const q = search.trim().toLowerCase();
    records.forEach((rec, idx) => {
      if (q && !resolveTitle(rec).toLowerCase().includes(q)) return;
      let startY = dateKeys[0] ? parseToLocalYMD(resolveFieldText(rec, dateKeys[0])) : null;
      let endY = dateKeys[1]
        ? parseToLocalYMD(resolveFieldText(rec, dateKeys[1]))
        : null;
      if (dateKeys.length === 1 && startY) {
        endY = startY;
      }
      if (!startY) {
        const c = parseToLocalYMD(rec.createdAt);
        if (!c) return;
        startY = c;
        endY = c;
      }
      if (!endY) endY = startY;
      let t0 = ymdToTime(startY);
      let t1 = ymdToTime(endY) + range.dayMs - 1;
      if (t1 < t0) [t0, t1] = [t1, t0];
      if (t1 < range.startMs || t0 > range.endMs) return;
      const clip0 = Math.max(t0, range.startMs);
      const clip1 = Math.min(t1, range.endMs);
      const leftPct = ((clip0 - range.startMs) / span) * 100;
      const widthPct = Math.max(0.8, ((clip1 - clip0) / span) * 100);
      out.push({
        record: rec,
        title: resolveTitle(rec),
        leftPct,
        widthPct,
        bg: BAR_COLORS[idx % BAR_COLORS.length],
      });
    });
    return out;
  }, [records, range, dateKeys, search, cardTitleField]);

  const todayLeftPct = useMemo(() => {
    if (todayMs < range.startMs || todayMs > range.endMs) return null;
    const span = Math.max(1, range.endMs - range.startMs);
    return ((todayMs - range.startMs) / span) * 100;
  }, [todayMs, range]);

  const createRecord = async () => {
    const name = newRecordName.trim();
    if (!name || creatingRecord) return;
    setCreatingRecord(true);
    try {
      const created = await createCustomObjectRecord(objectId, { values: { name } });
      setRecords((prev) => [created, ...prev]);
      setNewRecordName('');
      setShowNewModal(false);
    } catch {
      // ignore
    } finally {
      setCreatingRecord(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-[120rem] mx-auto space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {t('crm.workspace.gantt.title')}
            </h1>
            <p className="text-sm text-slate-500">{t('crm.workspace.gantt.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => { setShowNewModal(true); setNewRecordName(''); }}
            className="rounded-xl bg-lumiva-accent px-3 py-2 text-sm font-medium text-white hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
          >
            + {t('crm.workspace.common.newRecord')}
          </button>
        </div>
        <WorkspaceViewTabs objectId={objectId} active="gantt" />

        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowNewModal(false)} />
            <div className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
              <h2 className="text-base font-semibold text-slate-900 mb-3">{t('crm.workspace.common.newRecord')}</h2>
              <input
                autoFocus
                value={newRecordName}
                onChange={(e) => setNewRecordName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void createRecord(); if (e.key === 'Escape') setShowNewModal(false); }}
                placeholder={t('crm.workspace.kanban.cardNamePlaceholder')}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm mb-3"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void createRecord()}
                  disabled={!newRecordName.trim() || creatingRecord}
                  className="rounded-xl bg-lumiva-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {creatingRecord ? t('crm.workspace.common.updating') : t('crm.workspace.common.create')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  {t('crm.workspace.common.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 bg-slate-50/80">
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => {
                const d = new Date(anchor);
                d.setDate(d.getDate() - 14);
                setAnchor(startOfWeekMonday(d));
              }}
            >
              ←
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => setAnchor(startOfWeekMonday(new Date()))}
            >
              {t('crm.workspace.gantt.today')}
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => {
                const d = new Date(anchor);
                d.setDate(d.getDate() + 14);
                setAnchor(startOfWeekMonday(d));
              }}
            >
              →
            </button>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('crm.workspace.gantt.search')}
              className="ml-auto w-full sm:w-64 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          {loading ? (
            <div className="p-8 text-sm text-slate-500">{t('crm.workspace.common.loadingData')}</div>
          ) : dateKeys.length === 0 ? (
            <div className="p-8 text-sm text-amber-700 bg-amber-50/50">
              {t('crm.workspace.gantt.needDates')}
            </div>
          ) : (
            <div className="flex min-h-[320px]">
              <div className="w-52 shrink-0 border-r border-slate-100 bg-slate-50/40">
                <div className="h-10 border-b border-slate-100 px-3 flex items-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {t('crm.workspace.gantt.tasks')}
                </div>
                {rows.map((r) => (
                  <div
                    key={r.record.id}
                    className="h-11 px-3 flex items-center text-sm text-slate-800 border-b border-slate-50 truncate"
                    title={r.title}
                  >
                    {r.title}
                  </div>
                ))}
                {rows.length === 0 && (
                  <div className="p-4 text-xs text-slate-500">{t('crm.workspace.gantt.empty')}</div>
                )}
              </div>
              <div className="flex-1 min-w-0 overflow-x-auto">
                <div className="min-w-[840px]">
                  <div
                    className="grid h-10 border-b border-slate-100 text-[10px] text-slate-500"
                    style={{ gridTemplateColumns: `repeat(${range.labels.length}, minmax(0,1fr))` }}
                  >
                    {range.labels.map((lab) => (
                      <div key={lab.t} className="border-l border-slate-100 px-1 flex items-end pb-1">
                        {lab.label}
                      </div>
                    ))}
                  </div>
                  <div className="relative">
                    {typeof todayLeftPct === 'number' && (
                      <div
                        className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-sky-500/80"
                        style={{ left: `${todayLeftPct}%` }}
                      >
                        <span className="absolute -top-1 left-1 text-[9px] font-medium text-sky-600 whitespace-nowrap">
                          {t('crm.workspace.gantt.todayMarker')}
                        </span>
                      </div>
                    )}
                    {rows.map((r) => (
                      <div
                        key={r.record.id}
                        className="relative h-11 border-b border-slate-50 bg-white"
                      >
                        <div
                          className="absolute top-2 h-7 rounded-lg shadow-sm border border-white/40"
                          style={{
                            left: `${r.leftPct}%`,
                            width: `${r.widthPct}%`,
                            background: r.bg,
                            minWidth: 8,
                          }}
                          title={`${r.title}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};
