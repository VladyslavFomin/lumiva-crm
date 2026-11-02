import type { AuraBlockLayout, AuraFormat, AuraTone, AuraWidgetData } from '../../api/aura';

/* «Показать как»: те же данные блока — в другом виде. Только перекладка уже посчитанных чисел,
   ничего не досчитывается и не выдумывается. Плюс топ-N, сортировка и скрытие сравнения. */

/** Виды, которых нет в ответе сервера, — рисуются только на клиенте. */
export type AuColumnsData = { type: 'columns'; format: AuraFormat; labels: string[]; series: Array<{ name: string; data: number[]; dash?: boolean }>; stacked: boolean };
export type AuRingData = { type: 'ring'; value: number; format: AuraFormat; pct: number; target: number | null; delta: Extract<AuraWidgetData, { type: 'kpi' }>['delta']; good: boolean | null };
export type AuViewData = AuraWidgetData | AuColumnsData | AuRingData;

type Item = { key?: string; name: string; value: number; tone?: AuraTone };

export type AuTransformCtx = {
  /** Подпись элемента списка (источник лида, статус…) — как в родном виде блока. */
  label: (it: { key?: string; name: string }) => string;
  /** Подпись бакета периода по оси X. */
  bucket: (label: string) => string;
  /** Подписи серий «текущий / прошлый период». */
  cur: string;
  prev: string;
  t: (k: string, o?: Record<string, unknown>) => string;
};

const pctDelta = (cur: number, prev: number) => (prev ? { kind: 'pct' as const, value: Math.round(((cur - prev) / prev) * 1000) / 10 } : null);

/** Любые «списочные» данные → единый список элементов. */
export function itemsOf(d: AuraWidgetData, ctx: AuTransformCtx): { items: Item[]; format: AuraFormat } | null {
  switch (d.type) {
    case 'donut':
      return { format: d.format, items: d.items.map((x) => ({ key: x.key, name: ctx.label(x), value: x.value })) };
    case 'bar':
      return { format: d.format, items: d.items.map((x) => ({ name: ctx.label({ name: x.name }), value: x.value })) };
    case 'segbar':
      return { format: d.format, items: d.items.map((x) => ({ key: x.key, name: ctx.t(`crm.aura.part.${x.key}`), value: x.value, tone: x.tone })) };
    case 'gauge':
      return { format: 'int', items: d.rows.map((x) => ({ key: x.key, name: ctx.t(`crm.aura.part.${x.key}`), value: x.value, tone: x.tone })) };
    case 'funnel':
      return { format: 'int', items: d.steps.map((x) => ({ key: x.key, name: ctx.t(`crm.aura.funnel.${x.key}`), value: x.value })) };
    case 'split':
      return {
        format: d.format,
        items: [d.a, d.b].map((x) => ({ key: x.key, name: ctx.t(`crm.aura.part.${x.key}`), value: x.value })),
      };
    case 'col':
      return { format: 'int', items: d.labels.map((h, i) => ({ name: `${String(h).padStart(2, '0')}:00`, value: d.data[i] || 0 })) };
    default:
      return null;
  }
}

const tableOf = (items: Item[], format: AuraFormat): AuraWidgetData => {
  const tot = items.reduce((a, b) => a + b.value, 0);
  return {
    type: 'table',
    cols: [
      { key: 'group', kind: 'text' },
      { key: 'value', kind: format === 'money' ? 'money' : format === 'pct' ? 'pct' : format === 'num' ? 'num' : 'int' },
      ...(format === 'pct' ? [] : [{ key: 'share', kind: 'pct' as const }]),
    ],
    rows: items.map((x) => ({ group: x.name, value: x.value, share: tot ? Math.round((x.value / tot) * 1000) / 10 : null })),
  };
};

/** Топ-N и сортировка для списков; «прочее» сохраняет сумму в кольцах, чтобы доли не врали. */
function shape(items: Item[], b: AuraBlockLayout | undefined, keepOther: boolean): Item[] {
  let list = [...items];
  if (b?.sort) list.sort((x, y) => (b.sort === 'asc' ? x.value - y.value : y.value - x.value));
  if (b?.limit && list.length > b.limit) {
    const top = list.slice(0, keepOther ? b.limit - 1 : b.limit);
    const rest = list.slice(top.length).reduce((a, x) => a + x.value, 0);
    list = keepOther && rest > 0 ? [...top, { key: 'other', name: 'other', value: rest }] : top;
  }
  return list;
}

/** Применяет вид и настройки блока к данным. view — из layout.viz (или родной). */
export function auView(d: AuraWidgetData, view: string | undefined, b: AuraBlockLayout | undefined, ctx: AuTransformCtx): AuViewData {
  const showPrev = b?.prev !== false;
  const v = view || d.type;

  if (d.type === 'kpi') {
    const base = showPrev ? d : { ...d, delta: null, good: null };
    if (v === 'kpi_ring' && d.value != null) {
      const target = b?.target ?? null;
      const pct = target ? (d.value / target) * 100 : d.format === 'pct' ? d.value : null;
      if (pct != null) return { type: 'ring', value: d.value, format: d.format, pct, target, delta: base.delta, good: base.good };
    }
    return base;
  }

  if (d.type === 'line') {
    const series = showPrev
      ? [
          { name: ctx.cur, data: d.current },
          { name: ctx.prev, data: d.previous, dash: true },
        ]
      : [{ name: ctx.cur, data: d.current }];
    if (v === 'columns') return { type: 'columns', format: d.format, labels: [], series, stacked: false };
    if (v === 'kpi') {
      const delta = showPrev ? pctDelta(d.total, d.prevTotal) : null;
      return { type: 'kpi', value: d.total, format: d.format, delta, good: delta ? delta.value > 0 : null, spark: d.current };
    }
    return showPrev ? d : { ...d, previous: [], prevTotal: 0 };
  }

  if (d.type === 'multi') {
    if (v === 'stacked') return { type: 'columns', format: d.format, labels: [], series: d.series.map((s) => ({ name: ctx.t(`crm.aura.multi.${s.key}`), data: s.data })), stacked: true };
    if (v === 'table')
      return tableOf(
        d.series.map((s) => ({ name: ctx.t(`crm.aura.multi.${s.key}`), value: s.data.reduce((a, x) => a + x, 0) })),
        d.format,
      );
    return d;
  }

  if (d.type === 'col2') {
    if (v === 'table')
      return {
        type: 'table',
        cols: [
          { key: 'month', kind: 'text' },
          { key: 'income', kind: 'money' },
          { key: 'adSpend', kind: 'money' },
          { key: 'net', kind: 'money' },
        ],
        rows: d.labels.map((l, i) => ({ month: ctx.bucket(l), income: d.a[i], adSpend: d.b[i], net: Math.round((d.a[i] - d.b[i]) * 100) / 100 })),
      };
    return d;
  }

  if (d.type === 'table') {
    let rows = d.rows;
    if (b?.limit) rows = rows.slice(0, b.limit);
    return { ...d, rows };
  }

  if (d.type === 'stream') return b?.limit ? { ...d, items: d.items.slice(0, b.limit) } : d;

  const it = itemsOf(d, ctx);
  if (!it) return d;
  const native = v === d.type;
  // родной вид: только топ-N/сортировка, структура данных та же
  if (native) {
    if (d.type === 'bar') return { ...d, items: shape(d.items.map((x) => ({ name: x.name, value: x.value })), b, false) };
    if (d.type === 'donut') return { ...d, items: shape(d.items.map((x) => ({ key: x.key, name: x.name, value: x.value })), b, d.format !== 'pct') };
    return d;
  }
  const items = shape(it.items, b, v === 'donut' || v === 'pie');
  switch (v) {
    case 'donut':
    case 'pie':
      return { type: 'donut', format: it.format, items: items.filter((x) => x.value > 0).map((x) => ({ key: x.key === 'other' ? 'other' : `~${x.name}`, name: x.name, value: x.value })) };
    case 'bar':
      return { type: 'bar', format: it.format, items: items.map((x) => ({ name: x.name, value: x.value })), people: d.type === 'bar' ? d.people : false };
    case 'segbar':
      return { type: 'segbar', format: it.format, items: items.map((x) => ({ key: `~${x.name}`, value: x.value, tone: x.tone })) };
    case 'columns':
      return { type: 'columns', format: it.format, labels: items.map((x) => x.name), series: [{ name: '', data: items.map((x) => x.value) }], stacked: false };
    case 'table':
      return tableOf(items, it.format);
  }
  return d;
}

/** Есть ли у результата хоть одно значение — чтобы честно показать «нет данных», а не пустую графику. */
export function hasData(d: AuViewData): boolean {
  switch (d.type) {
    case 'kpi':
      return d.value != null;
    case 'line':
      return d.current.some((x) => x > 0) || d.previous.some((x) => x > 0);
    case 'columns':
      return d.series.some((s) => s.data.some((x) => x > 0));
    case 'donut':
    case 'bar':
    case 'segbar':
      return d.items.some((x) => x.value > 0);
    case 'table':
      return d.rows.length > 0;
    default:
      return true;
  }
}
