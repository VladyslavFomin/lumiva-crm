import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { auraApi, type AuraCustomWidget, type AuraDatasets, type AuraFieldKind } from '../../api/aura';
import { auNewCustomKey } from './auraModel';
import { AU_I, AuIc } from './auraShared';
import { AU_DATASET_COMPONENT, UnlockButton } from './AuraUnlock';

/* «Свой показатель» без ИИ: набор данных → что считать → разрез → фильтры → вид.
   Сервер принимает только поля из реестра (aura-custom.ts), так что собрать «невозможный» запрос нельзя. */

type Field = { key: string; label: string; kind: AuraFieldKind; values: string[] | null; date?: boolean };
type Ds = { key: string; label: string; fields: Field[]; noPeriod: boolean; table: boolean };
type Op = NonNullable<AuraCustomWidget['filters']>[number]['op'];

let dsCache: AuraDatasets | null = null;
function useDatasets() {
  const [d, setD] = useState<AuraDatasets | null>(dsCache);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (dsCache) return;
    auraApi
      .datasets()
      .then((r) => setD((dsCache = r)))
      .catch((e: Error) => setErr(e.message));
  }, []);
  return { data: d, err };
}

const STATUS_NS: Record<string, string> = { leads: 'lead', sales: 'sale', bookings: 'booking', calls: 'call' };

/** Подпись значения перечисления (статусы, источники, направления) — как в остальной Aura. */
export function enumLabel(t: TFunction, ds: string, field: string, v: string) {
  if (field === 'status' && STATUS_NS[ds]) return t(`crm.aura.st.${STATUS_NS[ds]}.${v}`, { defaultValue: v });
  if ((field === 'source' && ds === 'leads') || field === 'lead_source') return t(`crm.aura.leadSource.${v}`, { defaultValue: v });
  if (field === 'direction') return t(`crm.aura.stream.dir.${v}`, { defaultValue: v });
  if (field === 'sentiment') return t(`crm.aura.cb.sentiment.${v}`, { defaultValue: v });
  if (field === 'status' && ds === 'products') return t(`crm.aura.cb.productStatus.${v}`, { defaultValue: v });
  return v;
}

const NUMERIC = (k: AuraFieldKind) => k === 'number' || k === 'money';

function toDs(api: AuraDatasets, t: TFunction): Ds[] {
  const b = api.builtin.map((d) => ({
    key: d.key,
    label: t(`crm.aura.ds.${d.key}`, { defaultValue: d.key }),
    noPeriod: d.noPeriod,
    table: false,
    fields: d.fields.map((f) => ({ key: f.key, label: t(`crm.aura.dsf.${d.key}.${f.key}`, { defaultValue: t(`crm.aura.dsf.any.${f.key}`, { defaultValue: f.key }) }), kind: f.kind, values: f.values })),
  }));
  const tb = api.tables.map((x) => ({
    key: x.key,
    label: x.name,
    noPeriod: false,
    table: true,
    fields: x.fields.map((f) => ({ key: f.key, label: f.label || f.key, kind: f.kind, values: null, date: f.date })),
  }));
  return [...b, ...tb];
}

const OPS_BY_KIND: Record<string, Op[]> = {
  enum: ['in', 'eq', 'neq', 'empty', 'notempty'],
  text: ['contains', 'eq', 'neq', 'empty', 'notempty'],
  person: ['notempty', 'empty'],
  bool: ['eq'],
  number: ['gt', 'gte', 'lt', 'lte', 'eq', 'empty', 'notempty'],
  money: ['gt', 'gte', 'lt', 'lte', 'empty', 'notempty'],
};

export function AuraCustomBuilder({ initial, onSave, onCancel }: { initial?: AuraCustomWidget | null; onSave: (c: AuraCustomWidget) => void; onCancel?: () => void }) {
  const { t } = useTranslation();
  const { data, err } = useDatasets();
  const list = useMemo(() => (data ? toDs(data, t) : []), [data, t]);
  const [c, setC] = useState<AuraCustomWidget>(
    () =>
      initial || {
        id: auNewCustomKey(),
        title: '',
        viz: 'kpi',
        dataset: '',
        measure: { agg: 'count' },
        filters: [],
        groupBy: null,
        limit: 8,
        lowerIsBetter: false,
        dateField: null,
      },
  );
  const [touchedTitle, setTouchedTitle] = useState(!!initial?.title);
  const ds = list.find((d) => d.key === c.dataset) || null;
  useEffect(() => {
    if (!c.dataset && list.length) setC((x) => ({ ...x, dataset: list[0].key }));
  }, [list, c.dataset]);

  // режим разреза: одно число / по времени / по полю
  const mode: 'none' | 'date' | 'field' = !c.groupBy ? 'none' : c.groupBy === 'date' ? 'date' : 'field';
  const numeric = ds?.fields.filter((f) => NUMERIC(f.kind)) || [];
  const groupable = ds?.fields.filter((f) => !NUMERIC(f.kind) && !f.date) || [];
  const fieldOf = (k?: string | null) => ds?.fields.find((f) => f.key === k) || null;

  // название по умолчанию собирается само, пока клиент его не правил
  const autoTitle = useMemo(() => {
    if (!ds) return '';
    const m = c.measure.agg === 'count' ? t('crm.aura.cb.countOf', { ds: ds.label }) : t(`crm.aura.cb.aggOf.${c.measure.agg}`, { ds: ds.label, field: (fieldOf(c.measure.field)?.label || '').toLowerCase() });
    const g = mode === 'field' ? ` ${t('crm.aura.cb.by', { field: (fieldOf(c.groupBy)?.label || '').toLowerCase() })}` : mode === 'date' ? ` ${t('crm.aura.cb.overTime')}` : '';
    return (m + g).slice(0, 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds, c.measure, c.groupBy, mode, t]);
  const title = touchedTitle ? c.title : autoTitle;

  const setDataset = (key: string) => setC((x) => ({ ...x, dataset: key, measure: { agg: 'count' }, filters: [], groupBy: x.groupBy === 'date' ? 'date' : null, dateField: null, viz: x.groupBy === 'date' ? 'line' : x.groupBy ? 'kpi' : x.viz }));
  const setMode = (m: typeof mode) =>
    setC((x) => ({ ...x, groupBy: m === 'none' ? null : m === 'date' ? 'date' : groupable[0]?.key || null, viz: m === 'none' ? 'kpi' : m === 'date' ? 'line' : 'bar' }));
  const valid = !!ds && (c.measure.agg === 'count' || !!fieldOf(c.measure.field)) && (mode !== 'field' || !!fieldOf(c.groupBy)) && title.trim().length > 0;

  if (err) return <p className="au-bhint">{err}</p>;
  if (!data) return <p className="au-bhint">{t('crm.aura.dash.loading')}</p>;
  if (!list.length)
    return (
      <div className="au-cb-empty">
        <p className="au-bhint">{t('crm.aura.cb.noDatasets')}</p>
        {data.locked.length > 0 && <UnlockButton components={[...new Set(data.locked.map((k) => AU_DATASET_COMPONENT[k]).filter(Boolean))]} />}
      </div>
    );

  return (
    <div className="au-cb">
      <label className="au-bfield">
        <span>{t('crm.aura.cb.dataset')}</span>
        <select className="au-bsel" value={c.dataset} onChange={(e) => setDataset(e.target.value)}>
          <optgroup label={t('crm.aura.cb.crmData')}>
            {list
              .filter((d) => !d.table)
              .map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
          </optgroup>
          {list.some((d) => d.table) && (
            <optgroup label={t('crm.aura.cb.tables')}>
              {list
                .filter((d) => d.table)
                .map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
            </optgroup>
          )}
        </select>
        {data.locked.length > 0 && (
          <em className="au-bhint au-cb-locked">
            {t('crm.aura.cb.lockedSets', { list: data.locked.map((k) => t(`crm.aura.ds.${k}`, { defaultValue: k })).join(', ') })}
            <UnlockButton components={[...new Set(data.locked.map((k) => AU_DATASET_COMPONENT[k]).filter(Boolean))]} compact />
          </em>
        )}
      </label>

      <div className="au-bfield">
        <span>{t('crm.aura.cb.measure')}</span>
        <div className="au-cb-row">
          <select
            className="au-bsel"
            value={c.measure.agg}
            onChange={(e) => {
              const agg = e.target.value as AuraCustomWidget['measure']['agg'];
              setC((x) => ({ ...x, measure: agg === 'count' ? { agg } : { agg, field: x.measure.field && fieldOf(x.measure.field) && NUMERIC(fieldOf(x.measure.field)!.kind) ? x.measure.field : numeric[0]?.key } }));
            }}
          >
            <option value="count">{t('crm.aura.cb.agg.count')}</option>
            {numeric.length > 0 &&
              (['sum', 'avg', 'min', 'max'] as const).map((a) => (
                <option key={a} value={a}>
                  {t(`crm.aura.cb.agg.${a}`)}
                </option>
              ))}
          </select>
          {c.measure.agg !== 'count' && (
            <select className="au-bsel" value={c.measure.field || ''} onChange={(e) => setC((x) => ({ ...x, measure: { ...x.measure, field: e.target.value } }))}>
              {numeric.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          )}
        </div>
        {!numeric.length && <em className="au-bhint">{t('crm.aura.cb.noNumeric')}</em>}
      </div>

      <div className="au-bfield">
        <span>{t('crm.aura.cb.split')}</span>
        <div className="au-bseg">
          {(['none', 'date', 'field'] as const).map((m) => (
            <button type="button" key={m} className={mode === m ? 'on' : ''} disabled={(m === 'field' && !groupable.length) || (m === 'date' && !!ds?.noPeriod)} onClick={() => setMode(m)}>
              {t(`crm.aura.cb.mode.${m}`)}
            </button>
          ))}
        </div>
        {mode === 'field' && (
          <div className="au-cb-row">
            <select className="au-bsel" value={c.groupBy || ''} onChange={(e) => setC((x) => ({ ...x, groupBy: e.target.value }))}>
              {groupable.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <select className="au-bsel au-bsel-s" value={c.viz} onChange={(e) => setC((x) => ({ ...x, viz: e.target.value as AuraCustomWidget['viz'] }))}>
              {(['bar', 'donut', 'table'] as const).map((v) => (
                <option key={v} value={v}>
                  {t(`crm.aura.viz.${v}`)}
                </option>
              ))}
            </select>
          </div>
        )}
        {mode === 'none' && ds?.noPeriod && <em className="au-bhint">{t('crm.aura.cb.noPeriodHint')}</em>}
        {ds?.table && (
          <label className="au-cb-row au-cb-sub">
            <em>{t('crm.aura.cb.dateField')}</em>
            <select className="au-bsel" value={c.dateField || ''} onChange={(e) => setC((x) => ({ ...x, dateField: e.target.value || null }))}>
              <option value="">{t('crm.aura.cb.noDate')}</option>
              {ds.fields
                .filter((f) => f.date)
                .map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>

      <div className="au-bfield">
        <span>{t('crm.aura.cb.filters')}</span>
        {(c.filters || []).map((fl, i) => {
          const fd = fieldOf(fl.field);
          const ops = OPS_BY_KIND[fd?.kind || 'text'];
          const needsValue = !['empty', 'notempty'].includes(fl.op);
          const upd = (patch: Partial<typeof fl>) => setC((x) => ({ ...x, filters: (x.filters || []).map((y, j) => (j === i ? { ...y, ...patch } : y)) }));
          return (
            <div key={i} className="au-cb-filter">
              <select
                className="au-bsel"
                value={fl.field}
                onChange={(e) => {
                  const nf = fieldOf(e.target.value);
                  upd({ field: e.target.value, op: OPS_BY_KIND[nf?.kind || 'text'][0], value: undefined });
                }}
              >
                {ds?.fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select className="au-bsel au-bsel-s" value={fl.op} onChange={(e) => upd({ op: e.target.value as Op })}>
                {ops.map((o) => (
                  <option key={o} value={o}>
                    {t(`crm.aura.cb.op.${o}`)}
                  </option>
                ))}
              </select>
              {needsValue &&
                (fd?.values?.length ? (
                  fl.op === 'in' ? (
                    <div className="au-cb-vals">
                      {fd.values.map((v) => {
                        const cur = Array.isArray(fl.value) ? (fl.value as string[]) : [];
                        const on = cur.includes(v);
                        return (
                          <button type="button" key={v} className={on ? 'on' : ''} onClick={() => upd({ value: on ? cur.filter((x) => x !== v) : [...cur, v] })}>
                            {enumLabel(t, c.dataset, fl.field, v)}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <select className="au-bsel" value={String(fl.value ?? '')} onChange={(e) => upd({ value: e.target.value })}>
                      <option value="" disabled>
                        {t('crm.aura.cb.pick')}
                      </option>
                      {fd.values.map((v) => (
                        <option key={v} value={v}>
                          {enumLabel(t, c.dataset, fl.field, v)}
                        </option>
                      ))}
                    </select>
                  )
                ) : fd?.kind === 'bool' ? (
                  <select className="au-bsel" value={String(fl.value ?? 'true')} onChange={(e) => upd({ value: e.target.value })}>
                    <option value="true">{t('crm.aura.cb.bool.true')}</option>
                    <option value="false">{t('crm.aura.cb.bool.false')}</option>
                  </select>
                ) : (
                  <input
                    className="au-bsel"
                    type={NUMERIC(fd?.kind || 'text') ? 'number' : 'text'}
                    value={Array.isArray(fl.value) ? fl.value.join(', ') : String(fl.value ?? '')}
                    placeholder={t('crm.aura.cb.value')}
                    onChange={(e) => upd({ value: NUMERIC(fd?.kind || 'text') ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value })}
                  />
                ))}
              <button type="button" className="au-cb-x" onClick={() => setC((x) => ({ ...x, filters: (x.filters || []).filter((_, j) => j !== i) }))} aria-label={t('crm.aura.cb.removeFilter')}>
                <AuIc d={AU_I.x} size={12} />
              </button>
            </div>
          );
        })}
        {(c.filters || []).length < 8 && ds && (
          <button
            type="button"
            className="au-cb-add"
            onClick={() => {
              const f = ds.fields.find((x) => x.values?.length) || ds.fields[0];
              setC((x) => ({ ...x, filters: [...(x.filters || []), { field: f.key, op: OPS_BY_KIND[f.kind][0], value: undefined }] }));
            }}
          >
            <AuIc d={AU_I.plus} size={12} />
            {t('crm.aura.cb.addFilter')}
          </button>
        )}
      </div>

      <label className="au-bfield">
        <span>{t('crm.aura.block.title')}</span>
        <div className="au-binput">
          <input
            value={title}
            maxLength={120}
            onChange={(e) => {
              setTouchedTitle(true);
              setC((x) => ({ ...x, title: e.target.value }));
            }}
          />
        </div>
      </label>
      {mode !== 'field' && (
        <label className="au-check">
          <input type="checkbox" checked={!!c.lowerIsBetter} onChange={(e) => setC((x) => ({ ...x, lowerIsBetter: e.target.checked }))} />
          {t('crm.aura.cb.lowerBetter')}
        </label>
      )}

      <div className="au-cb-f">
        {onCancel && (
          <button type="button" className="btn btn-sm" onClick={onCancel}>
            {t('crm.aura.cancel')}
          </button>
        )}
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={!valid}
          onClick={() =>
            onSave({
              ...c,
              title: title.trim(),
              // пустые фильтры (не выбрано значение) не отправляем — сервер их бы отбросил, а клиент думал бы, что фильтр работает
              filters: (c.filters || []).filter((f) => ['empty', 'notempty'].includes(f.op) || (Array.isArray(f.value) ? f.value.length > 0 : f.value !== undefined && f.value !== '')),
            })
          }
        >
          {initial ? t('crm.aura.cb.apply') : t('crm.aura.cb.create')}
        </button>
      </div>
    </div>
  );
}
