import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchCustomObjects,
  fetchCustomObjectFields,
  fetchCustomObjectRecords,
  type CustomObject,
  type CustomObjectField,
  type CustomObjectRecord,
} from '../../api/customObjects';
import { WorkspaceViewTabs } from '../../components/workspace/WorkspaceViewTabs';
import { useWorkspaceViewAccess } from '../../workspace/useWorkspaceViewAccess';
import { dayKeysFromStartEndStrings, toLocalDateKey } from '../../utils/calendarLocalDates';

export const WorkspaceCalendarViewPage: React.FC = () => {
  const { t } = useTranslation();
  const { objectId = '' } = useParams();
  useWorkspaceViewAccess(objectId, 'calendar');
  const [fields, setFields] = useState<CustomObjectField[]>([]);
  const [objectMeta, setObjectMeta] = useState<CustomObject['meta'] | null>(null);
  const [records, setRecords] = useState<CustomObjectRecord[]>([]);
  const [activeRecord, setActiveRecord] = useState<CustomObjectRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!objectId) return;
    setLoading(true);
    Promise.all([
      fetchCustomObjectFields(objectId),
      fetchCustomObjectRecords(objectId),
      fetchCustomObjects().catch(() => [] as CustomObject[]),
    ])
      .then(([loadedFields, res, objects]) => {
        setFields(loadedFields.filter((field) => field.isActive));
        setRecords(res.items);
        const object = objects.find((item) => item.id === objectId);
        setObjectMeta((object?.meta as Record<string, any> | null) || null);
      })
      .finally(() => setLoading(false));
  }, [objectId]);

  const cardTitleField = useMemo(() => {
    const saved = String((objectMeta as Record<string, any> | null)?.kanban?.cardTitleField || '').trim();
    if (saved) return saved;
    return (
      fields.find((field) => field.key === 'name')?.key ||
      fields.find((field) => field.key === 'title')?.key ||
      ''
    );
  }, [fields, objectMeta]);
  /** Порядок полей в схеме: 1-я дата — начало (заказ и т.п.), 2-я — конец (доставка); диапазон по обеим. */
  const customDateFieldKeys = useMemo(
    () =>
      fields
        .filter((field) => field.type === 'date' || field.type === 'datetime')
        .map((field) => field.key),
    [fields],
  );
  const resolveSystemValue = (record: CustomObjectRecord, key: string) => {
    if (key === '$record.id') return record.id;
    if (key === '$record.externalId') return record.externalId || '';
    if (key === '$record.createdAt') return record.createdAt || '';
    if (key === '$record.updatedAt') return record.updatedAt || '';
    return '';
  };
  const resolveFieldText = (record: CustomObjectRecord, key: string) => {
    if (!key) return '';
    const raw = key.startsWith('$record.') ? resolveSystemValue(record, key) : record.values?.[key];
    if (raw === undefined || raw === null) return '';
    if (Array.isArray(raw)) return raw.map((value) => String(value)).join(', ');
    if (typeof raw === 'object') return '';
    return String(raw).trim();
  };
  const resolveEventTitle = (record: CustomObjectRecord) =>
    resolveFieldText(record, cardTitleField) ||
    String(record.values?.name || record.values?.title || record.id);
  /** Ключи дней (локальные YYYY-MM-DD), в которые попадает запись. */
  const pickDayKeysForRecord = (record: CustomObjectRecord): string[] => {
    if (customDateFieldKeys.length >= 2) {
      const startRaw = resolveFieldText(record, customDateFieldKeys[0]);
      const endRaw = resolveFieldText(record, customDateFieldKeys[1]);
      if (startRaw || endRaw) {
        return dayKeysFromStartEndStrings(startRaw || endRaw, endRaw || startRaw);
      }
    }
    if (customDateFieldKeys.length === 1) {
      const startRaw = resolveFieldText(record, customDateFieldKeys[0]);
      if (startRaw) {
        return dayKeysFromStartEndStrings(startRaw, null);
      }
    }
    const created = record.createdAt;
    if (!created) return [];
    const k = toLocalDateKey(created);
    return k ? [k] : [];
  };
  const renderRecordValue = (value: any): string => {
    if (value === undefined || value === null || value === '') return '—';
    if (Array.isArray(value)) return value.map((item) => String(item)).join(', ') || '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const grouped = useMemo(() => {
    return records.reduce<Record<string, CustomObjectRecord[]>>((acc, rec) => {
      if (search.trim()) {
        const haystack = `${resolveEventTitle(rec)} ${String(rec.values?.description || '')}`.toLowerCase();
        if (!haystack.includes(search.trim().toLowerCase())) return acc;
      }
      const dayKeys = pickDayKeysForRecord(rec);
      if (!dayKeys.length) {
        const k = 'without_date';
        acc[k] = acc[k] || [];
        acc[k].push(rec);
        return acc;
      }
      const seen = new Set<string>();
      dayKeys.forEach((key) => {
        if (seen.has(key)) return;
        seen.add(key);
        acc[key] = acc[key] || [];
        acc[key].push(rec);
      });
      return acc;
    }, {});
  }, [records, search, cardTitleField, customDateFieldKeys]);

  const monthLabel = useMemo(
    () => anchorDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    [anchorDate],
  );

  const monthDays = useMemo(() => {
    const year = anchorDate.getFullYear();
    const month = anchorDate.getMonth();
    const first = new Date(year, month, 1);
    const startWeekDay = (first.getDay() + 6) % 7;
    const result: Array<{ iso: string; day: number; inCurrentMonth: boolean }> = [];
    const cursor = new Date(year, month, 1 - startWeekDay);
    for (let i = 0; i < 42; i++) {
      result.push({
        iso: toLocalDateKey(cursor),
        day: cursor.getDate(),
        inCurrentMonth: cursor.getMonth() === month,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [anchorDate]);

  const weekDays = useMemo(() => {
    const base = new Date(anchorDate);
    const weekday = (base.getDay() + 6) % 7;
    base.setDate(base.getDate() - weekday);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return {
        iso: toLocalDateKey(d),
        label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
      };
    });
  }, [anchorDate]);

  const hasItems = records.length > 0;

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{t('crm.workspace.calendar.title')}</h1>
            <p className="text-sm text-slate-500">{t('crm.workspace.calendar.subtitle')}</p>
          </div>
          <WorkspaceViewTabs objectId={objectId} active="calendar" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="text-sm text-slate-600">{monthLabel}</div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`px-3 py-2 rounded-xl border text-sm transition-all duration-200 ${
                  viewMode === 'month'
                    ? 'border-slate-300 bg-slate-100 text-lumiva-accent'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {t('crm.workspace.calendar.month')}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('week')}
                className={`px-3 py-2 rounded-xl border text-sm transition-all duration-200 ${
                  viewMode === 'week'
                    ? 'border-slate-300 bg-slate-100 text-lumiva-accent'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {t('crm.workspace.calendar.week')}
              </button>
              <button
                type="button"
                onClick={() =>
                  setAnchorDate((prev) => {
                    const next = new Date(prev);
                    next.setDate(next.getDate() + (viewMode === 'month' ? -30 : -7));
                    return next;
                  })
                }
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-700 transition-all duration-200 hover:bg-slate-50"
              >
                {t('crm.workspace.calendar.prev')}
              </button>
              <button
                type="button"
                onClick={() =>
                  setAnchorDate((prev) => {
                    const next = new Date(prev);
                    next.setDate(next.getDate() + (viewMode === 'month' ? 30 : 7));
                    return next;
                  })
                }
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-700 transition-all duration-200 hover:bg-slate-50"
              >
                {t('crm.workspace.calendar.next')}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('crm.workspace.calendar.searchEvents')}
              className="w-full md:w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">{t('crm.workspace.common.loading')}</div>
        ) : !hasItems ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
            {t('crm.workspace.calendar.noDatedRecords')}
          </div>
        ) : viewMode === 'month' ? (
          <div className="grid grid-cols-7 gap-2">
            {monthDays.map((d) => {
              const dayItems = grouped[d.iso] || [];
              return (
                <div
                  key={d.iso}
                  className={`rounded-xl border min-h-28 p-2 transition-all duration-200 hover:shadow-sm ${
                    d.inCurrentMonth
                      ? 'border-slate-200 bg-white'
                      : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <div className="text-xs text-slate-500 mb-1">{d.day}</div>
                  <div className="space-y-1">
                    {dayItems.slice(0, 3).map((rec) => (
                      <button
                        type="button"
                        key={rec.id}
                        onClick={() => setActiveRecord(rec)}
                        className="w-full text-left text-[11px] rounded-md bg-slate-100 text-lumiva-accent px-1.5 py-0.5 truncate hover:bg-slate-200/80 transition-colors"
                      >
                        {resolveEventTitle(rec)}
                      </button>
                    ))}
                    {dayItems.length > 3 && (
                      <div className="text-[11px] text-slate-500">
                        {t('crm.workspace.calendar.moreCount', { count: dayItems.length - 3 })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {weekDays.map((d) => {
              const dayItems = grouped[d.iso] || [];
              return (
                <div key={d.iso} className="rounded-xl border border-slate-200 bg-white p-2 min-h-44 transition-all duration-200 hover:shadow-sm">
                  <div className="text-xs uppercase tracking-[0.12em] text-slate-500 mb-2">
                    {d.label}
                </div>
                <div className="space-y-2">
                  {dayItems.map((rec) => (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => setActiveRecord(rec)}
                      className="w-full text-left rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs hover:bg-slate-100 transition-colors"
                    >
                      {resolveEventTitle(rec)}
                    </button>
                  ))}
                  {dayItems.length === 0 && (
                    <div className="text-[11px] text-slate-400">{t('crm.workspace.common.noRecords')}</div>
                  )}
                </div>
              </div>
            );
            })}
          </div>
        )}

        {activeRecord && (
          <div className="fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/30" onClick={() => setActiveRecord(null)} />
            <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white border-l border-slate-200 shadow-2xl p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  {resolveEventTitle(activeRecord)}
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveRecord(null)}
                  className="rounded-full border border-slate-300 px-2 py-1 text-xs"
                >
                  {t('crm.workspace.recordDrawer.close')}
                </button>
              </div>
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    {t('crm.workspace.common.created')}
                  </div>
                  <div className="text-sm text-slate-800">{new Date(activeRecord.createdAt).toLocaleString()}</div>
                </div>
                {fields.map((field) => (
                  <div key={`calendar-field-${field.id}`} className="rounded-lg border border-slate-200 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{field.label}</div>
                    <div className="text-sm text-slate-800 mt-1">
                      {renderRecordValue(activeRecord.values?.[field.key])}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

