/**
 * Правила колонок рабочей таблицы (field.meta.rules).
 *
 * Два вида правил, оба хранятся на колонке, из меню «⋯» которой их настроили:
 *  - condition: «Если {колонка} {является / не является / пусто / > …} {значения} →
 *    потом {колонка} {заполнить значением | должно быть: не пусто / равно / больше …} {значение}».
 *    «Заполнить» — автозаполнение при сохранении строки, «должно быть» — проверка (400 с текстом).
 *  - validation: ограничение значений самой колонки (не пусто / только из списка / диапазон / сравнение).
 *
 * Выполняется на сервере в createRecord/updateRecord — значит работает одинаково из таблицы,
 * карточки строки, ИИ-инструментов и публичного API. Импорт и синхронизации правила не гоняют
 * (иначе одна «плохая» строка выгрузки валила бы весь пакет).
 */

export type RuleConditionOp =
  | 'is'
  | 'is_not'
  | 'empty'
  | 'not_empty'
  | 'contains'
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte';

export type RuleCheckOp =
  | 'not_empty'
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'one_of'
  | 'between';

export type ColumnRuleCondition = {
  fieldKey: string;
  op: RuleConditionOp;
  values?: string[];
  value?: string;
};

export type ColumnRuleAction =
  | { fieldKey: string; kind: 'set'; value: unknown }
  | { fieldKey: string; kind: 'clear' }
  | { fieldKey: string; kind: 'check'; op: RuleCheckOp; value?: string; values?: string[]; min?: string; max?: string };

export type ColumnRule =
  | { id: string; type: 'condition'; enabled?: boolean; when: ColumnRuleCondition; then: ColumnRuleAction[] }
  | {
      id: string;
      type: 'validation';
      enabled?: boolean;
      op: RuleCheckOp;
      value?: string;
      values?: string[];
      min?: string;
      max?: string;
    };

export type RuleField = { key: string; label: string; type: string; meta?: Record<string, any> | null };

export type RuleViolation = {
  fieldKey: string;
  fieldLabel: string;
  op: RuleCheckOp;
  expected: string;
  ruleOnLabel: string;
  conditionText: string | null;
  /** Для локализации на фронте: параметры проверки и условия. */
  params: { value?: string; values?: string[]; min?: string; max?: string };
  condition: { fieldLabel: string; op: RuleConditionOp; values: string[] } | null;
};

const CONDITION_OPS: RuleConditionOp[] = ['is', 'is_not', 'empty', 'not_empty', 'contains', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte'];
const CHECK_OPS: RuleCheckOp[] = ['not_empty', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'one_of', 'between'];
const MAX_RULES_PER_FIELD = 30;
const MAX_ACTIONS_PER_RULE = 10;

const str = (v: unknown, max = 500): string => String(v ?? '').slice(0, max);
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, 300)).filter((x) => x.trim() !== '').slice(0, 100) : [];

/** Приводит то, что прислал клиент, к безопасной форме; неизвестные/битые правила выбрасываются. */
export function sanitizeColumnRules(raw: unknown, knownKeys: Set<string>): ColumnRule[] {
  if (!Array.isArray(raw)) return [];
  const out: ColumnRule[] = [];
  for (const r of raw.slice(0, MAX_RULES_PER_FIELD)) {
    if (!r || typeof r !== 'object') continue;
    const rr = r as Record<string, any>;
    const id = str(rr.id, 64) || Math.random().toString(36).slice(2, 10);
    const enabled = rr.enabled !== false;
    if (rr.type === 'condition') {
      const w = rr.when || {};
      if (!knownKeys.has(String(w.fieldKey)) || !CONDITION_OPS.includes(w.op)) continue;
      const when: ColumnRuleCondition = {
        fieldKey: String(w.fieldKey),
        op: w.op,
        ...(strList(w.values).length ? { values: strList(w.values) } : {}),
        ...(w.value !== undefined && w.value !== null ? { value: str(w.value) } : {}),
      };
      const then: ColumnRuleAction[] = [];
      for (const a of Array.isArray(rr.then) ? rr.then.slice(0, MAX_ACTIONS_PER_RULE) : []) {
        if (!a || typeof a !== 'object' || !knownKeys.has(String(a.fieldKey))) continue;
        const fieldKey = String(a.fieldKey);
        if (a.kind === 'set') {
          const value = Array.isArray(a.value) ? strList(a.value) : typeof a.value === 'boolean' ? a.value : str(a.value);
          then.push({ fieldKey, kind: 'set', value });
        } else if (a.kind === 'clear') {
          then.push({ fieldKey, kind: 'clear' });
        } else if (a.kind === 'check' && CHECK_OPS.includes(a.op)) {
          then.push({
            fieldKey,
            kind: 'check',
            op: a.op,
            ...(a.value !== undefined && a.value !== null ? { value: str(a.value) } : {}),
            ...(strList(a.values).length ? { values: strList(a.values) } : {}),
            ...(a.min !== undefined && a.min !== '' ? { min: str(a.min, 60) } : {}),
            ...(a.max !== undefined && a.max !== '' ? { max: str(a.max, 60) } : {}),
          });
        }
      }
      if (!then.length) continue;
      out.push({ id, type: 'condition', enabled, when, then });
    } else if (rr.type === 'validation' && CHECK_OPS.includes(rr.op)) {
      out.push({
        id,
        type: 'validation',
        enabled,
        op: rr.op,
        ...(rr.value !== undefined && rr.value !== null ? { value: str(rr.value) } : {}),
        ...(strList(rr.values).length ? { values: strList(rr.values) } : {}),
        ...(rr.min !== undefined && rr.min !== '' ? { min: str(rr.min, 60) } : {}),
        ...(rr.max !== undefined && rr.max !== '' ? { max: str(rr.max, 60) } : {}),
      });
    }
  }
  return out;
}

export function readColumnRules(meta: Record<string, any> | null | undefined): ColumnRule[] {
  const r = meta?.rules;
  return Array.isArray(r) ? (r as ColumnRule[]) : [];
}

// ── сравнение значений ──────────────────────────────────────────────────────────────────

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** Значение ячейки как список строковых токенов (multiselect → много, файл → имя). */
function tokens(v: unknown): string[] {
  if (isEmpty(v)) return [];
  if (Array.isArray(v)) return v.map(norm).filter(Boolean);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return [norm(o.label ?? o.name ?? o.originalName ?? o.value ?? JSON.stringify(o))];
  }
  return [norm(v)];
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return null;
  const s = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Сравнение для >, <, = : числа как числа, даты (ISO / дд.мм.гггг) как даты, иначе строки. */
function compare(a: unknown, b: unknown): number | null {
  const an = toNumber(a);
  const bn = toNumber(b);
  if (an !== null && bn !== null) return an - bn;
  const ad = toDate(a);
  const bd = toDate(b);
  if (ad !== null && bd !== null) return ad - bd;
  const as = norm(a);
  const bs = norm(b);
  if (!as || !bs) return null;
  return as.localeCompare(bs);
}

function toDate(v: unknown): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const ru = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (ru) return Date.UTC(Number(ru[3]), Number(ru[2]) - 1, Number(ru[1]));
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function valueEquals(cell: unknown, expected: string): boolean {
  const c = compare(cell, expected);
  if (c !== null && toNumber(cell) !== null && toNumber(expected) !== null) return c === 0;
  const want = norm(expected);
  return tokens(cell).includes(want) || (typeof cell === 'boolean' && String(cell) === want);
}

export function conditionMatches(cond: ColumnRuleCondition, values: Record<string, unknown>): boolean {
  const cell = values[cond.fieldKey];
  const list = (cond.values?.length ? cond.values : cond.value !== undefined ? [cond.value] : []).map(norm);
  switch (cond.op) {
    case 'empty':
      return isEmpty(cell);
    case 'not_empty':
      return !isEmpty(cell);
    case 'is': {
      if (!list.length) return false;
      const t = typeof cell === 'boolean' ? [String(cell)] : tokens(cell);
      return t.some((x) => list.includes(x));
    }
    case 'is_not': {
      if (!list.length) return false;
      const t = typeof cell === 'boolean' ? [String(cell)] : tokens(cell);
      return !t.some((x) => list.includes(x));
    }
    case 'contains': {
      const needle = norm(cond.value ?? cond.values?.[0]);
      return !!needle && tokens(cell).some((x) => x.includes(needle));
    }
    case 'eq':
      return cond.value !== undefined && valueEquals(cell, cond.value);
    case 'neq':
      return cond.value !== undefined && !valueEquals(cell, cond.value);
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      if (isEmpty(cell) || cond.value === undefined) return false;
      const c = compare(cell, cond.value);
      if (c === null) return false;
      return cond.op === 'gt' ? c > 0 : cond.op === 'gte' ? c >= 0 : cond.op === 'lt' ? c < 0 : c <= 0;
    }
    default:
      return false;
  }
}

function checkPasses(
  op: RuleCheckOp,
  cell: unknown,
  p: { value?: string; values?: string[]; min?: string; max?: string },
): boolean {
  switch (op) {
    case 'not_empty':
      return !isEmpty(cell);
    case 'one_of': {
      if (isEmpty(cell)) return true; // пустое значение — не нарушение; для обязательности есть not_empty
      const allowed = (p.values || []).map(norm);
      if (!allowed.length) return true;
      return tokens(cell).every((x) => allowed.includes(x));
    }
    case 'between': {
      if (isEmpty(cell)) return true;
      if (p.min !== undefined && p.min !== '') {
        const c = compare(cell, p.min);
        if (c === null || c < 0) return false;
      }
      if (p.max !== undefined && p.max !== '') {
        const c = compare(cell, p.max);
        if (c === null || c > 0) return false;
      }
      return true;
    }
    case 'eq':
      return p.value !== undefined && valueEquals(cell, p.value);
    case 'neq':
      return p.value === undefined || !valueEquals(cell, p.value);
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      if (p.value === undefined || p.value === '') return true;
      if (isEmpty(cell)) return false;
      const c = compare(cell, p.value);
      if (c === null) return false;
      return op === 'gt' ? c > 0 : op === 'gte' ? c >= 0 : op === 'lt' ? c < 0 : c <= 0;
    }
    default:
      return true;
  }
}

/** Значение для «заполнить значением» в типе целевой колонки (до coerceFieldValue сервиса). */
function setValueFor(field: RuleField | undefined, value: unknown): unknown {
  if (!field) return value;
  if (field.type === 'number') return toNumber(value);
  if (field.type === 'boolean') return value === true || norm(value) === 'true' || norm(value) === '1';
  if (field.type === 'multiselect') return Array.isArray(value) ? value : isEmpty(value) ? [] : [String(value)];
  return Array.isArray(value) ? value[0] ?? '' : value;
}

const COND_TEXT: Record<RuleConditionOp, string> = {
  is: '=',
  is_not: '≠',
  empty: 'пусто',
  not_empty: 'не пусто',
  contains: 'содержит',
  eq: '=',
  neq: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
};

const CHECK_TEXT: Record<RuleCheckOp, string> = {
  not_empty: 'не пустым',
  eq: '=',
  neq: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  one_of: 'одним из',
  between: 'в диапазоне',
};

function expectedText(op: RuleCheckOp, p: { value?: string; values?: string[]; min?: string; max?: string }) {
  if (op === 'not_empty') return CHECK_TEXT[op];
  if (op === 'one_of') return `${CHECK_TEXT[op]}: ${(p.values || []).join(', ')}`;
  if (op === 'between') return `${CHECK_TEXT[op]} ${p.min ?? '…'} – ${p.max ?? '…'}`;
  return `${CHECK_TEXT[op]} ${p.value ?? ''}`.trim();
}

/**
 * Применяет правила к уже нормализованным значениям строки.
 * - Автозаполнение: целевая колонка, которую пользователь явно меняет в ЭТОМ же сохранении,
 *   не перезаписывается — ручной ввод важнее правила.
 * - Проверки на обновлении касаются только правил, затронутых изменёнными колонками, — иначе
 *   новое правило блокировало бы правку любой старой строки, которая ему не соответствует.
 * Возвращает новые значения + список нарушений (пустой — всё ок).
 */
export function applyColumnRules(
  fields: RuleField[],
  values: Record<string, unknown>,
  opts: { mode: 'create' | 'update'; changedKeys?: Set<string> | null },
): { values: Record<string, unknown>; violations: RuleViolation[]; changedByRules: string[] } {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const next: Record<string, unknown> = { ...values };
  const changedByRules = new Set<string>();
  const explicit = opts.changedKeys ?? null;
  const touched = (k: string) => opts.mode === 'create' || !explicit || explicit.has(k) || changedByRules.has(k);
  const all: Array<{ owner: RuleField; rule: ColumnRule }> = [];
  for (const f of fields) {
    for (const rule of readColumnRules(f.meta)) {
      if (rule.enabled === false) continue;
      all.push({ owner: f, rule });
    }
  }
  if (!all.length) return { values: next, violations: [], changedByRules: [] };

  // 1) автозаполнение — два прохода, чтобы цепочки «A → B, B → C» срабатывали.
  for (let pass = 0; pass < 2; pass++) {
    for (const { rule } of all) {
      if (rule.type !== 'condition' || !conditionMatches(rule.when, next)) continue;
      for (const a of rule.then) {
        if (a.kind !== 'set' && a.kind !== 'clear') continue;
        if (explicit && explicit.has(a.fieldKey) && !changedByRules.has(a.fieldKey)) continue;
        const field = byKey.get(a.fieldKey);
        if (!field || field.type === 'ai' || field.type === 'file') continue;
        const v = a.kind === 'clear' ? (field.type === 'multiselect' ? [] : null) : setValueFor(field, a.value);
        if (JSON.stringify(next[a.fieldKey] ?? null) !== JSON.stringify(v ?? null)) {
          next[a.fieldKey] = v;
          changedByRules.add(a.fieldKey);
        }
      }
    }
  }

  // 2) проверки
  const violations: RuleViolation[] = [];
  for (const { owner, rule } of all) {
    if (rule.type === 'validation') {
      if (!touched(owner.key)) continue;
      if (!checkPasses(rule.op, next[owner.key], rule)) {
        violations.push({
          fieldKey: owner.key,
          fieldLabel: owner.label,
          op: rule.op,
          expected: expectedText(rule.op, rule),
          ruleOnLabel: owner.label,
          conditionText: null,
          params: { value: rule.value, values: rule.values, min: rule.min, max: rule.max },
          condition: null,
        });
      }
      continue;
    }
    if (!conditionMatches(rule.when, next)) continue;
    for (const a of rule.then) {
      if (a.kind !== 'check') continue;
      if (!touched(a.fieldKey) && !touched(rule.when.fieldKey)) continue;
      if (checkPasses(a.op, next[a.fieldKey], a)) continue;
      const target = byKey.get(a.fieldKey);
      const condField = byKey.get(rule.when.fieldKey);
      const condVals = rule.when.values?.length ? rule.when.values.join(', ') : rule.when.value ?? '';
      violations.push({
        fieldKey: a.fieldKey,
        fieldLabel: target?.label || a.fieldKey,
        op: a.op,
        expected: expectedText(a.op, a),
        ruleOnLabel: owner.label,
        conditionText: `${condField?.label || rule.when.fieldKey} ${COND_TEXT[rule.when.op]} ${condVals}`.trim(),
        params: { value: a.value, values: a.values, min: a.min, max: a.max },
        condition: {
          fieldLabel: condField?.label || rule.when.fieldKey,
          op: rule.when.op,
          values: rule.when.values?.length ? rule.when.values : rule.when.value !== undefined ? [rule.when.value] : [],
        },
      });
    }
  }
  return { values: next, violations, changedByRules: [...changedByRules] };
}

export function formatRuleViolations(v: RuleViolation[]): string {
  return v
    .slice(0, 5)
    .map((x) =>
      x.conditionText
        ? `«${x.fieldLabel}» должно быть ${x.expected} (если ${x.conditionText})`
        : `«${x.fieldLabel}» должно быть ${x.expected}`,
    )
    .join('; ');
}
