/**
 * Защита от выдуманных чисел при записи в рабочую область из ИИ-чата.
 *
 * Реальный случай (2026-10-08): «сделай такую же работу по Meta» — модель не вызвала ни одного
 * инструмента с данными и сразу записала в таблицу придуманные расходы (153 249,75 / 120 000,5 /
 * 200 000 TRY…) и даже несуществующие названия кабинетов. Поэтому перед записью проверяем,
 * что числа строки встречаются в результатах инструментов или в сообщениях пользователя.
 */

const WRITE_TOOLS = new Set(['crm_workspace_add_record', 'crm_workspace_bulk_add_records', 'crm_workspace_update_record']);

/** Все числа из текста; «727 887,43» и «727887.4298» оба распознаются. */
export function extractNumbers(text: string): number[] {
  const norm = text
    .replace(/(\d)[\s  ](?=\d{3}(?!\d))/g, '$1')
    .replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2');
  const out: number[] = [];
  for (const m of norm.matchAll(/-?\d+(?:\.\d+)?/g)) {
    const n = Number(m[0]);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

function significantNumbers(values: Record<string, unknown>): number[] {
  const out: number[] = [];
  for (const v of Object.values(values)) {
    const n = typeof v === 'number' ? v : typeof v === 'string' && /^-?\d+(?:\.\d+)?$/.test(v.trim()) ? Number(v) : NaN;
    // Мелкие числа (0, проценты, порядковые) не показательны — проверяем только «данные».
    if (Number.isFinite(n) && Math.abs(n) >= 10) out.push(n);
  }
  return out;
}

function rowsOf(name: string, args: Record<string, unknown>): Record<string, unknown>[] {
  if (name === 'crm_workspace_bulk_add_records') {
    const recs = Array.isArray(args.records) ? args.records : [];
    return recs
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r))
      .map((r) => (r.values && typeof r.values === 'object' && !Array.isArray(r.values) ? (r.values as Record<string, unknown>) : r));
  }
  const v = args.values;
  return v && typeof v === 'object' && !Array.isArray(v) ? [v as Record<string, unknown>] : [];
}

/**
 * null — запись можно выполнять; иначе JSON-ответ инструмента с отказом.
 * Строка отклоняется, только если НИ ОДНО её значимое число не найдено в evidence
 * (производные суммы допустимы, пока рядом есть хотя бы одно число из данных).
 */
export function checkWorkspaceWriteProvenance(
  name: string,
  argStr: string,
  evidence: number[],
  /** Числа из рекламных данных CRM и из слов пользователя — такие цифры в таблицу переносит только импорт. */
  split?: { marketing: number[]; user: number[] },
): string | null {
  if (!WRITE_TOOLS.has(name)) return null;
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argStr || '{}');
  } catch {
    return null;
  }
  const matches = (v: number) => evidence.some((e) => Math.abs(e - v) < 0.51);
  const badRows: number[] = [];
  rowsOf(name, args).forEach((row, i) => {
    const nums = significantNumbers(row);
    if (nums.length && !nums.some(matches)) badRows.push(i);
  });
  if (!badRows.length && split?.marketing.length) {
    const mk = evidenceSet(split.marketing);
    const us = evidenceSet(split.user);
    const copied: number[] = [];
    rowsOf(name, args).forEach((row, i) => {
      const nums = significantNumbers(row);
      if (nums.some((v) => near(mk, v, Math.max(0.51, v * 0.0005)) && !near(us, v, 0.51))) copied.push(i);
    });
    if (copied.length) {
      return JSON.stringify({
        ok: false,
        error: 'use_marketing_import',
        badRows: copied,
        hint:
          'Цифры рекламы из CRM в таблицу вручную не переписываются (так раньше путались месяцы/кабинеты). Сразу, не спрашивая пользователя, сделай то же самое импортом — пустую таблицу для ручного ввода система удалит сама. ' +
          'Используй crm_workspace_import_marketing_monthly_breakdown (groupBy "client" + clients для брендов/отелей, "dataSource" — по кабинетам, "market" — по странам; dataSource "meta_ads"/"google_ads" для одной площадки) ' +
          'или crm_workspace_import_marketing_channels — сервер сам заполнит таблицу и будет обновлять её каждую ночь.',
      });
    }
  }
  if (!badRows.length) return null;
  return JSON.stringify({
    ok: false,
    error: 'values_not_from_data',
    badRows,
    hint:
      'Числа в этих строках не встречаются ни в результатах инструментов, ни в сообщениях пользователя — похоже, они выдуманы. ' +
      'Сначала получи реальные данные нужным инструментом (например crm_marketing_overview с dataSource "meta_ads" / "google_ads" и нужным периодом), ' +
      'затем запиши в таблицу ровно эти значения и названия аккаунтов из providerBreakdown[].label. Никогда не придумывай цифры.',
  });
}

/** Отсортированный уникальный набор чисел-«доказательств» для быстрых проверок. */
export function evidenceSet(numbers: number[]): number[] {
  return [...new Set(numbers.map((n) => Math.round(n * 100) / 100))].sort((a, b) => a - b);
}

function near(sorted: number[], v: number, tol: number): boolean {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (Math.abs(sorted[mid] - v) <= tol) return true;
    if (sorted[mid] < v) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}

/**
 * Числа из ответа/отчёта модели, которых нет в данных и которые нельзя получить простым
 * действием из них (сумма/разница двух значений, итог подряд идущих чисел ответа, доля).
 * Игнорирует мелкие числа (<100), годы, проценты, даты, ссылки и id — их проверка дала бы шум.
 */
export function findUnverifiedNumbers(text: string, evidence: number[], limit = 12): string[] {
  const E = evidenceSet(evidence.filter((n) => Math.abs(n) >= 1));
  if (!E.length) return [];
  const clean = String(text || '')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b|\b\d{1,2}:\d{2}\b/g, ' ')
    .replace(/\b[a-z_]+_\d+\b/gi, ' ');
  const norm = clean
    .replace(/(\d)[\s  ](?=\d{3}(?!\d))/g, '$1')
    .replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2')
    .replace(/(\d),(?=\d{3}(?!\d))/g, '$1');
  const found: Array<{ raw: string; v: number }> = [];
  for (const m of norm.matchAll(/-?\d+(?:\.\d+)?(\s*%)?/g)) {
    if (m[1]) continue; // проценты — производные
    const v = Math.abs(Number(m[0]));
    // дробные от 10 тоже проверяем: цена конверсии/клика (реальный случай: CPA «39,86» вместо 29,16)
    if (!Number.isFinite(v) || v < (/\.\d/.test(m[0]) ? 10 : 100)) continue;
    if (Number.isInteger(v) && v >= 1990 && v <= 2100) continue;
    found.push({ raw: m[0].trim(), v });
  }
  const tolOf = (v: number) => Math.max(0.51, v * 0.0005);
  const direct = (v: number) =>
    near(E, v, tolOf(v)) || near(E, v * 1000, 510) || near(E, v * 1_000_000, 510_000);
  const verified = found.filter((f) => direct(f.v)).map((f) => f.v);
  const bad: string[] = [];
  found.forEach((f, idx) => {
    const v = f.v;
    if (direct(v)) return;
    // для производных — строгий допуск, иначе в большом снимке «сумма каких-то двух чисел» найдётся почти всегда
    const tol = /\.\d/.test(f.raw) ? 0.011 : 0.51;
    // сумма/разница двух значений из данных (например два кабинета одного бренда);
    // в большом наборе хотя бы одно слагаемое должно быть названо в самом ответе
    for (const e of E.length <= 400 ? E : verified) {
      if ((e < v && near(E, v - e, tol)) || (e > v && near(E, e - v, tol))) return;
    }
    // итог подряд идущих чисел ответа (строки таблицы → «Итого»)
    for (let s = 0; s < idx; s++) {
      let sum = 0;
      for (let k = s; k < idx; k++) sum += found[k].v;
      if (Math.abs(sum - v) <= Math.max(1, v * 0.001)) return;
    }
    // доля/средняя цена (расход / конверсии и т.п.) из чисел данных, упомянутых в ответе
    for (const a of verified) for (const b of verified) if (b && Math.abs(a / b - v) <= Math.max(0.01, v * 0.005)) return;
    // сумма трёх значений (бренд из трёх кабинетов)
    for (const a of verified) if (verified.some((b) => b !== a && near(E, v - a - b, tol))) return;
    bad.push(f.raw);
  });
  return [...new Set(bad)].slice(0, limit);
}

import { monthsMentioned } from './ai-period-parse';

const TOTAL_ROW_RE = /итог|всего|сумма|\btotal\b|\bsum\b|toplam|genel/i;
/** Несуммируемые столбцы (средние, доли, цены за единицу): их «Итого» — не сумма, не трогаем. */
const NON_ADDITIVE_RE = /cpa|cpc|cpm|ctr|cr\b|roas|roi|ср\.|средн|avg|average|mean|цена|за (клик|конверс|лид)|на (клик|лид)|per |доля|share|rate|ставк|курс|%|процент|конверси[яи] \(|ortalama|oran|başına|baz[ıi]nda|ölçü/i;

function parseCellNumber(cell: string): number | null {
  const t = cell.replace(/[*_`]/g, '').trim();
  if (!t || !/\d/.test(t)) return null;
  const nums = extractNumbers(t);
  // одна сумма в ячейке (возможно с валютой/знаком): «417 570,41 TRY», «₺728 000»
  if (nums.length !== 1) return null;
  if (/[^\d\s  .,\-+%₺$€£₽a-zA-Zа-яА-Я]/.test(t)) return null;
  if (/%/.test(t)) return null;
  return nums[0];
}

function formatLike(sample: string, v: number): string {
  const decimals = (() => {
    const m = sample.replace(/[*_`]/g, '').match(/[.,](\d{1,2})(?!\d)/);
    return m ? m[1].length : Number.isInteger(v) ? 0 : 2;
  })();
  const ru = /\d[\s  ]\d{3}/.test(sample) || /\d,\d{1,2}(?!\d)/.test(sample);
  const body = ru
    ? v.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : v.toFixed(decimals);
  return body;
}

/**
 * Строки «Итого/Total» в markdown-таблицах пересчитываются кодом: сумма значений столбца в строках
 * выше (до заголовка). На живых тестах модель трижды подряд неверно складывала итог, даже имея
 * готовую сумму в данных. Меняется только число в ячейке, оформление (жирный, валюта) сохраняется.
 */
export function fixMarkdownTableTotals(text: string): { text: string; fixes: Array<{ from: string; to: string }> } {
  const lines = String(text || '').split('\n');
  const fixes: Array<{ from: string; to: string }> = [];
  const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  const isSep = (l: string) => /^\s*\|[\s:|-]+\|\s*$/.test(l);
  const cells = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
  let i = 0;
  while (i < lines.length) {
    if (!(isRow(lines[i]) && i + 1 < lines.length && isSep(lines[i + 1]))) {
      i++;
      continue;
    }
    const body: number[] = [];
    let j = i + 2;
    while (j < lines.length && isRow(lines[j])) body.push(j++);
    // Столбец «Итого» при столбцах-месяцах («Август | Сентябрь | Итого»): итог строки = сумма месяцев.
    const header = cells(lines[i]).map((h) => h.replace(/[*_`]/g, ''));
    const totalCol = header.findIndex((h, k) => k > 0 && TOTAL_ROW_RE.test(h) && !NON_ADDITIVE_RE.test(h));
    const MONTH_ABBR = /^\s*(янв|фев|мар|апр|ма[йя]|июн|июл|авг|сен|окт|ноя|дек|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|oca|şub|nis|haz|tem|ağu|eyl|eki|kas|ara)/i;
    const isPeriod = (h: string) => MONTH_ABBR.test(h) || monthsMentioned(h).length > 0;
    const periodCols = header.map((h, k) => (k > 0 && k !== totalCol && isPeriod(h) ? k : -1)).filter((k) => k > 0);
    const fixRowTotals = () => {
      if (totalCol < 0 || periodCols.length < 2) return;
      for (const r of body) {
        const cs = cells(lines[r]);
        const cur = cs[totalCol] !== undefined ? parseCellNumber(cs[totalCol]) : null;
        if (cur === null) continue;
        const vals = periodCols.map((k) => (cs[k] !== undefined ? parseCellNumber(cs[k]) : null));
        if (vals.some((v, n) => v === null && /\d/.test(cs[periodCols[n]] ?? ''))) continue;
        const sum = Math.round(vals.reduce<number>((a, b) => a + (b ?? 0), 0) * 100) / 100;
        if (Math.abs(sum - cur) <= 0.011) continue;
        const m = cs[totalCol].match(/-?\d[\d\s\u00a0\u202f.,]*\d|\d/);
        if (!m) continue;
        fixes.push({ from: m[0].trim(), to: formatLike(m[0], sum) });
        cs[totalCol] = cs[totalCol].replace(m[0], formatLike(m[0], sum));
        lines[r] = `|${cs.join('|')}|`;
      }
    };
    fixRowTotals();
    const dataRows: string[][] = [];
    for (const r of body) {
      const cs = cells(lines[r]);
      if (cs[0] !== undefined && TOTAL_ROW_RE.test(cs[0].replace(/[*_`]/g, '')) && dataRows.length >= 2) {
        const out = cs.map((cell, col) => {
          if (col === 0 || NON_ADDITIVE_RE.test(header[col] ?? '')) return cell;
          const cur = parseCellNumber(cell);
          if (cur === null) return cell;
          const vals = dataRows.map((dr) => (dr[col] !== undefined ? parseCellNumber(dr[col]) : null));
          // столбец должен быть числовым во всех строках выше (пустые/«—» допускаются)
          if (vals.some((v, k) => v === null && /\d/.test(dataRows[k][col] ?? ''))) return cell;
          const nums = vals.filter((v): v is number => v !== null);
          if (nums.length < 2) return cell;
          const sum = Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100;
          if (Math.abs(sum - cur) <= Math.max(0.011, Math.abs(sum) * 1e-9)) return cell;
          const m = cell.match(/-?\d[\d\s  .,]*\d|\d/);
          if (!m) return cell;
          const replaced = cell.replace(m[0], formatLike(m[0], sum));
          fixes.push({ from: m[0].trim(), to: formatLike(m[0], sum) });
          return replaced;
        });
        lines[r] = `|${out.join('|')}|`;
        dataRows.length = 0; // следующий «Итого» в этой же таблице считается по новому блоку
        continue;
      }
      dataRows.push(cs);
    }
    fixRowTotals(); // строка «Итого» после пересчёта столбцов
    i = j;
  }
  return { text: lines.join('\n'), fixes };
}

/** То же для JSON-ответа (reportPreview/summary и т.п. внутри строк). */
export function fixTotalsInJsonText(raw: string): { text: string; fixes: Array<{ from: string; to: string }> } {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return { text: raw, fixes: [] };
  let obj: unknown;
  try {
    obj = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { text: raw, fixes: [] };
  }
  const fixes: Array<{ from: string; to: string }> = [];
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      if (!v.includes('|')) return v;
      const r = fixMarkdownTableTotals(v);
      fixes.push(...r.fixes);
      return r.text;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  const fixed = walk(obj);
  return fixes.length ? { text: JSON.stringify(fixed), fixes } : { text: raw, fixes };
}

export type NumberFact = { labels: string[]; month: string | null; value: number };

const MONTH_ABBR_LIST = [
  ['янв', 'jan', 'oca'], ['фев', 'feb', 'şub'], ['мар', 'mar'], ['апр', 'apr', 'nis'], ['ма', 'may'], ['июн', 'jun', 'haz'],
  ['июл', 'jul', 'tem'], ['авг', 'aug', 'ağu'], ['сен', 'sep', 'eyl'], ['окт', 'oct', 'eki'], ['ноя', 'nov', 'kas'], ['дек', 'dec', 'ara'],
];

/** Месяц из подписи ячейки/заголовка: «Август 2026» → {y:2026,m:8}; «Авг» → {m:8}. */
function monthSpec(s: string): { y?: number; m: number } | null {
  const t = s.replace(/[*_`]/g, '').trim().toLocaleLowerCase('tr');
  if (!t) return null;
  const iso = t.match(/\b(20\d\d)-(0[1-9]|1[0-2])\b/);
  if (iso) return { y: Number(iso[1]), m: Number(iso[2]) };
  const y = t.match(/\b(20\d\d)\b/);
  const full = monthsMentioned(t);
  if (full.length === 1) {
    const [yy, mm] = full[0].split('-').map(Number);
    return y ? { y: yy, m: mm } : { m: mm };
  }
  if (full.length > 1) return null;
  const idx = MONTH_ABBR_LIST.findIndex((ab) => ab.some((a) => t.startsWith(a) && (a !== 'ма' || /^ма[йяе]/.test(t)) && (a !== 'mar' || !/^mart[ıi]/.test(t))));
  return idx >= 0 ? { m: idx + 1, ...(y ? { y: Number(y[1]) } : {}) } : null;
}

const specMatches = (spec: { y?: number; m: number }, month: string) => {
  const [y, m] = month.split('-').map(Number);
  return spec.m === m && (spec.y === undefined || spec.y === y);
};

/**
 * Числа в таблицах ответа, стоящие не на своём месте: строка «Asteria», столбец «Август» — значение
 * должно совпасть с фактом Asteria за август (а не просто встречаться где-то в данных).
 * Проверяются только ячейки, для которых однозначно известны и группа, и месяц (или «итого»).
 */
export function findBindingMismatches(text: string, facts: NumberFact[], limit = 12): string[] {
  if (!facts.length) return [];
  const lines = String(text || '').split('\n');
  const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  const isSep = (l: string) => /^\s*\|[\s:|-]+\|\s*$/.test(l);
  const cellsOf = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
  const norm = (s: string) => s.replace(/[*_`]/g, '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
  const bad: string[] = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!(isRow(lines[i]) && isSep(lines[i + 1]))) continue;
    const header = cellsOf(lines[i]);
    const colMonth = header.map((h) => monthSpec(h));
    // «Сумма (TRY)» — это просто сумма денег, а не столбец итога
    const colTotal = header.map((h) => /итог|всего|\btotal\b|toplam/i.test(h.replace(/[*_`]/g, '')) && !NON_ADDITIVE_RE.test(h));
    for (let j = i + 2; j < lines.length && isRow(lines[j]); j++) {
      const cs = cellsOf(lines[j]);
      if (TOTAL_ROW_RE.test(norm(cs[0] ?? ''))) continue; // строки «Итого» пересчитывает fixMarkdownTableTotals
      const textCells = cs.filter((c) => parseCellNumber(c) === null).map(norm).filter(Boolean);
      // группа строки: факты с самым точным совпадением подписи (точное > «строка содержит подпись» >
      // «подпись содержит строку»), чтобы «Selectum» был брендом, а «HA - The Norm Hotels» — кабинетом
      let best: NumberFact[] = [];
      let bestScore = 0;
      for (const f of facts) {
        let score = 0;
        for (const l of f.labels) {
          const ln = norm(l);
          if (ln.length < 3) continue;
          for (const c of textCells) {
            const sc = c === ln ? 1 : c.includes(ln) ? ln.length / c.length : c.length >= 4 && ln.includes(c) ? (c.length / ln.length) * 0.99 : 0;
            if (sc > score) score = sc;
          }
        }
        if (!score) continue;
        if (score > bestScore + 1e-9) {
          bestScore = score;
          best = [];
        }
        if (Math.abs(score - bestScore) <= 1e-9) best.push(f);
      }
      if (!best.length) continue;
      const groupFacts = [...new Set(best)];
      const rowMonth = textCells.map(monthSpec).find(Boolean) ?? null;
      cs.forEach((c, k) => {
        if (k === 0) return;
        const v = parseCellNumber(c);
        if (v === null || Math.abs(v) < 100 || NON_ADDITIVE_RE.test(header[k] ?? '')) return;
        const spec = colMonth[k] ?? (colTotal[k] ? null : rowMonth);
        const isTotal = colTotal[k];
        if (!spec && !isTotal) return;
        const cand = groupFacts.filter((f) => (isTotal ? f.month === null : f.month !== null && spec && specMatches(spec, f.month)));
        if (!cand.length) return;
        const hasDec = /[.,]\d{1,2}(?!\d)/.test(c);
        const tol = hasDec ? 0.011 : 0.51;
        const ok = cand.some((f) => Math.abs(f.value - v) <= tol || Math.abs(f.value / 1000 - v) <= 0.51 || Math.abs(f.value / 1e6 - v) <= 0.051);
        if (!ok) bad.push(c.replace(/[*_`]/g, '').trim());
      });
    }
  }
  return [...new Set(bad)].slice(0, limit);
}

/**
 * Убирает markdown-таблицы, которые модель перепечатала из данных отчёта (их числа — факты отчёта),
 * чтобы в ответе осталась только таблица, вставленная сервером. Таблицы с другими данными не трогает.
 */
export function stripRetypedReportTables(text: string, facts: NumberFact[]): { text: string; removed: number } {
  if (!facts.length) return { text, removed: 0 };
  const E = evidenceSet(facts.map((f) => f.value));
  const lines = String(text || '').split('\n');
  const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  const isSep = (l: string) => /^\s*\|[\s:|-]+\|\s*$/.test(l);
  const out: string[] = [];
  let removed = 0;
  for (let i = 0; i < lines.length; i++) {
    if (isRow(lines[i]) && i + 1 < lines.length && isSep(lines[i + 1])) {
      let j = i + 2;
      while (j < lines.length && isRow(lines[j])) j++;
      const nums: number[] = [];
      for (let k = i + 2; k < j; k++) {
        for (const c of lines[k].trim().replace(/^\|/, '').replace(/\|$/, '').split('|')) {
          const v = parseCellNumber(c);
          if (v !== null && Math.abs(v) >= 100) nums.push(v);
        }
      }
      const hit = nums.filter((v) => near(E, v, Math.max(0.011, Math.abs(v) * 1e-7)) || near(E, Math.round(v), 0.51)).length;
      if (nums.length >= 2 && hit / nums.length >= 0.6) {
        removed++;
        i = j - 1;
        continue;
      }
    }
    out.push(lines[i]);
  }
  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n'), removed };
}
