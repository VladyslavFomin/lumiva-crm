/**
 * Агрегация плоских строк источника (GA4 / Meta / Woo) перед upsert в custom object.
 * Числовые колонки суммируются; не входящие в группировку текстовые — берутся из первой строки группы.
 */

import { parseDecimalString } from '../lib/locale-number.util';

function parseNumericCell(v: unknown): number | null {
  return parseDecimalString(v);
}

export function aggregateWorkspaceSourceRows(
  rows: Record<string, string>[],
  groupByKeys: string[],
): Record<string, string>[] {
  const gb = groupByKeys.filter(
    (k) =>
      k &&
      rows.some((r) => Object.prototype.hasOwnProperty.call(r, k)),
  );
  if (!rows.length || gb.length === 0) return rows;

  type Agg = { first: Record<string, string>; sums: Record<string, number> };
  const map = new Map<string, Agg>();

  for (const row of rows) {
    const gkey = gb.map((k) => String(row[k] ?? '').trim()).join('\x1e');
    let slot = map.get(gkey);
    if (!slot) {
      slot = { first: { ...row }, sums: {} };
      map.set(gkey, slot);
    }
    for (const [col, val] of Object.entries(row)) {
      if (gb.includes(col)) continue;
      const n = parseNumericCell(val);
      if (n !== null) {
        slot.sums[col] = (slot.sums[col] ?? 0) + n;
      }
    }
  }

  const out: Record<string, string>[] = [];
  for (const [, slot] of map) {
    const o: Record<string, string> = {};
    for (const k of gb) {
      o[k] = slot.first[k] ?? '';
    }
    for (const [col, sum] of Object.entries(slot.sums)) {
      o[col] = String(sum);
    }
    for (const [col, val] of Object.entries(slot.first)) {
      if (gb.includes(col)) continue;
      if (Object.prototype.hasOwnProperty.call(slot.sums, col)) continue;
      o[col] = val;
    }
    out.push(o);
  }
  return out;
}

export function workspaceAggregateRowId(
  row: Record<string, string>,
  groupByKeys: string[],
): string {
  const parts = groupByKeys.map((k) =>
    (String(row[k] ?? '').trim() || '-').replace(/\s+/g, '_').slice(0, 80),
  );
  const raw = parts.join('__');
  return raw.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 200) || 'agg';
}

export function applyWorkspaceImportAggregation(
  rows: Record<string, string>[],
  opts: {
    importMode?: 'full' | 'aggregate';
    aggregateGroupBySourceKeys?: string[];
  },
): Record<string, string>[] {
  if (
    opts.importMode !== 'aggregate' ||
    !opts.aggregateGroupBySourceKeys?.length
  ) {
    return rows;
  }
  const keys = opts.aggregateGroupBySourceKeys.map((k) => k.trim()).filter(Boolean);
  if (!keys.length) return rows;
  const agg = aggregateWorkspaceSourceRows(rows, keys);
  return agg.map((row) => ({
    ...row,
    id: workspaceAggregateRowId(row, keys),
  }));
}
