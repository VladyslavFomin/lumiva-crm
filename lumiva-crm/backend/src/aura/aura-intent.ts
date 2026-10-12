import {
  AURA_WIDGET_BY_KEY,
  auraDefaultWidgets,
  sanitizeAuraConfig,
  type AuraConfig,
  type AuraDensity,
  type AuraFilterKey,
  type AuraPeriod,
  type AuraSourceKey,
  type AuraTheme,
} from './aura-catalog';
import { isCustomKey, sanitizeCustom, sanitizeStyle, type AuraStyle } from './aura-custom';

/** Разбор без ИИ: по ключевым словам ru/en/tr. Используется, когда ИИ недоступен (нет квоты/ключа)
 * или ответ модели не разобрался. */

const SOURCE_RE: Array<[RegExp, AuraSourceKey]> = [
  [/лид|заявк|lead|potansiyel|başvuru|talep/i, 'leads'],
  [/сделк|продаж|воронк|выручк|deal|sale|revenue|funnel|satış|gelir|huni|ciro/i, 'deals'],
  [/менеджер|команд|сотрудн|отдел|manager|team|staff|employee|ekip|personel|çalışan|yönetici/i, 'team'],
  [/звон|sms|смс|телефон|call|phone|arama|telefon/i, 'calls'],
  [/брон|запис|загруз|салон|booking|appointment|occupanc|rezervasyon|randevu|doluluk/i, 'booking'],
  [/склад|товар|остат|stock|inventor|product|warehouse|stok|ürün|depo/i, 'stock'],
  [/финанс|прибыл|расход|p&l|доход|finance|profit|income|expense|finans|kâr|kar\b|gider/i, 'finance'],
  [/маркет|реклам|roi|канал|трафик|marketing|\bads?\b|advert|traffic|channel|cpl|pazarlama|reklam|kanal|trafik/i, 'marketing'],
];

export function detectSources(text: string): AuraSourceKey[] {
  const s = SOURCE_RE.filter(([re]) => re.test(text || '')).map(([, k]) => k);
  return s.length ? [...new Set(s)] : ['leads', 'deals'];
}

export function detectPeriod(text: string): AuraPeriod | null {
  const t = (text || '').toLowerCase();
  if (/сегодня|за день|today|bugün/.test(t)) return 'today';
  if (/недел|7 дн|week|hafta/.test(t)) return '7d';
  if (/квартал|quarter|çeyrek/.test(t)) return 'quarter';
  if (/\bгод|year|yıl/.test(t)) return 'year';
  if (/месяц|30 дн|month|\bay\b|aylık/.test(t)) return '30d';
  return null;
}

export function detectBreakdown(text: string): AuraFilterKey[] {
  const t = (text || '').toLowerCase();
  const out: AuraFilterKey[] = [];
  if (/менеджер|manager|yönetici|temsilci/.test(t)) out.push('manager');
  if (/канал|источник|channel|source|kanal|kaynak/.test(t)) out.push('channel');
  if (/филиал|branch|location|şube/.test(t)) out.push('branch');
  if (/продукт|товар|product|ürün/.test(t)) out.push('product');
  return out;
}

export function detectViewer(text: string) {
  const t = (text || '').toLowerCase();
  if (/тв|экран|tv|screen|ekran|televizyon/.test(t)) return 'tv' as const;
  return null;
}

export function fallbackBrief(prompt: string) {
  const sources = detectSources(prompt);
  const viewer = detectViewer(prompt);
  return {
    sources,
    widgets: auraDefaultWidgets(sources),
    period: detectPeriod(prompt) || (viewer === 'tv' ? 'today' : '30d'),
    breakdown: detectBreakdown(prompt),
    viewer,
    title: '',
  };
}

/** Выбор вариантов вопроса брифа по свободному ответу. */
export function fallbackAnswer(questionId: string, text: string, options: string[]): string[] {
  const t = (text || '').toLowerCase();
  if (questionId === 'sources') return detectSources(text).filter((s) => options.includes(s));
  if (questionId === 'period') {
    const p = detectPeriod(text);
    return p && options.includes(p) ? [p] : [];
  }
  if (questionId === 'breakdown') return detectBreakdown(text).filter((b) => options.includes(b));
  if (questionId === 'viewer') {
    if (/тв|экран|tv|screen|ekran/.test(t)) return ['tv'];
    if (/руковод|директор|leader|manager|lead|yönetici|müdür/.test(t)) return ['leaders'];
    if (/отдел|команд|все|team|everyone|ekip|herkes/.test(t)) return ['team'];
    if (/я|себ|\bme\b|myself|ben\b|kendim/.test(t)) return ['me'];
    return [];
  }
  if (questionId === 'widgets') {
    const words = t.split(/[^a-zа-яёçğıöşü0-9]+/i).filter((w) => w.length >= 4);
    return options.filter((k) => {
      const def = AURA_WIDGET_BY_KEY.get(k);
      return !!def && words.some((w) => def.ai.includes(w) || k.includes(w));
    });
  }
  return [];
}

export type AuraEditState = { config: AuraConfig; theme: AuraTheme; density: AuraDensity; title: string };
export type AuraEditOp =
  | { op: 'add' | 'remove'; widget: string }
  | { op: 'move'; widget: string; index: number }
  | { op: 'theme'; value: AuraTheme }
  | { op: 'density'; value: AuraDensity }
  | { op: 'period'; value: AuraPeriod }
  | { op: 'title'; value: string }
  | { op: 'breakdown_add' | 'breakdown_remove'; value: AuraFilterKey }
  | { op: 'goal'; value: number }
  | { op: 'add_custom'; widget: unknown }
  | { op: 'style'; value: AuraStyle }
  | { op: 'style_reset' };

/* цвета ru/en/tr для разбора без ИИ */
const COLORS: Array<[RegExp, string]> = [
  [/красн|red\b|kırmızı|kirmizi/, '#e5484d'],
  [/бордов|burgundy|bordo/, '#8b1e3f'],
  [/оранж|orange|turuncu/, '#f97316'],
  [/жёлт|желт|yellow|sarı|sari/, '#f5c518'],
  [/салатов|лайм|lime/, '#a3e635'],
  [/зел[её]н|green|yeşil|yesil/, '#1f9d55'],
  [/бирюз|teal|turkuaz/, '#14b8a6'],
  [/голуб|light blue|açık mavi|sky/, '#38bdf8'],
  [/син|blue|mavi|lacivert/, '#2f5bea'],
  [/фиолет|purple|violet|mor\b/, '#7c3aed'],
  [/розов|pink|pembe/, '#ec4899'],
  [/бежев|beige|bej/, '#efe6d8'],
  [/сер|gray|grey|gri/, '#8b8b95'],
  [/ч[её]рн|black|siyah/, '#0b0b0d'],
  [/бел|white|beyaz/, '#ffffff'],
];
const pickColor = (t: string): string | null => {
  const hex = t.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/i);
  if (hex) return hex[0];
  for (const [re, c] of COLORS) if (re.test(t)) return c;
  return null;
};

function fallbackStyleOps(t: string): AuraEditOp[] {
  if (/сброс|верни .*цвет|стандартн.*цвет|reset (colors|style)|renkleri sıfırla/.test(t)) return [{ op: 'style_reset' }];
  const color = pickColor(t);
  if (!color) return [];
  const target = /карточ|плитк|card|kart/.test(t)
    ? 'surface'
    : /текст|шрифт.*цвет|text|yazı/.test(t)
      ? 'ink'
      : /акцент|график|диаграм|столб|линия|accent|chart|grafik|vurgu/.test(t)
        ? 'accent'
        : 'bg';
  return [{ op: 'style', value: { [target]: color } as AuraStyle }];
}

/** Парсер правок без ИИ (порт auApplyEdit из макета + en/tr). */
export function fallbackEditOps(text: string, state: AuraEditState): AuraEditOp[] {
  const t = (text || '').toLowerCase();
  const ops: AuraEditOp[] = [];
  const styleOps = fallbackStyleOps(t);
  if (styleOps.length) return styleOps;
  if (/тёмн|темн|ночн|графит|dark|night|graphite|koyu|karanlık/.test(t)) ops.push({ op: 'theme', value: 'graphite' });
  else if (/чертёж|чертеж|blueprint|industr|teknik/.test(t)) ops.push({ op: 'theme', value: 'industry' });
  else if (/бенто|цветн|плитк|ярк|bento|colorful|renkli/.test(t)) ops.push({ op: 'theme', value: 'bento' });
  else if (/контраст|швейцар|swiss|contrast|kontrast/.test(t)) ops.push({ op: 'theme', value: 'swiss' });
  else if (/светл|монохром|как в crm|light|monochrome|açık/.test(t)) ops.push({ op: 'theme', value: 'lumiva' });

  const removing = /убер|удали|remove|delete|hide|kaldır|sil\b|gizle/.test(t);
  const want = (re: RegExp, widget: string) => {
    if (re.test(t)) ops.push({ op: removing ? 'remove' : 'add', widget });
  };
  want(/таблиц.*сделк|крупн.*сделк|deals table|biggest deal|büyük satış/, 'deals_table');
  want(/рейтинг|по менеджер|ranking|by manager|sıralama/, 'team_bar');
  want(/воронк|funnel|huni/, 'deals_funnel');
  want(/сравн|прошл|compare|previous|karşılaştır|önceki/, 'compare');
  want(/внимани|риск|алерт|attention|alert|risk|dikkat|uyarı/, 'alerts');
  want(/пропущ|missed|cevapsız/, 'calls_miss');
  want(/по часам|by hour|saatlik/, 'calls_hours');
  want(/тепловая|heatmap|ısı haritası/, 'book_heat');
  want(/заканчива|остатк|running out|low stock|azalan/, 'stock_low');
  want(/источник|sources|kaynak/, 'leads_src');
  want(/стоимост.*лид|cpl|cost per lead|lead başı/, 'mk_cpl');

  if (/плотн|компакт|compact|dense|sıkı/.test(t)) ops.push({ op: 'density', value: 'compact' });
  else if (/крупн|больш|large|bigger|büyük/.test(t) && !ops.some((o) => o.op === 'add')) ops.push({ op: 'density', value: 'large' });

  const p = detectPeriod(t);
  if (p && /период|покажи за|за |period|for the|dönem/.test(t)) ops.push({ op: 'period', value: p });

  const goal = t.match(/(?:цел|план|goal|target|hedef)\D{0,12}([\d\s.,]+)\s*(млн|тыс|k|m|million|bin|milyon)?/);
  if (goal) {
    let n = Number(goal[1].replace(/\s/g, '').replace(',', '.'));
    const mul = goal[2] || '';
    if (/млн|m|million|milyon/.test(mul)) n *= 1_000_000;
    else if (/тыс|k|bin/.test(mul)) n *= 1000;
    if (n > 0) ops.push({ op: 'goal', value: Math.round(n) });
  }

  if (removing && !ops.some((o) => o.op === 'remove') && state.config.widgets.length > 1) {
    ops.push({ op: 'remove', widget: state.config.widgets[state.config.widgets.length - 1] });
  }
  return ops;
}

/** Применяет операции к состоянию, отбрасывая всё, чего нет в каталоге. */
export function applyEditOps(state: AuraEditState, ops: AuraEditOp[]) {
  const cfg = sanitizeAuraConfig(state.config);
  let { theme, density, title } = state;
  const applied: AuraEditOp[] = [];
  let fresh: string | null = null;
  for (const o of ops) {
    if (!o || typeof o !== 'object') continue;
    if ((o.op === 'add' || o.op === 'remove' || o.op === 'move') && !AURA_WIDGET_BY_KEY.has(String(o.widget)) && !(o.op !== 'add' && isCustomKey(String(o.widget)) && (cfg.custom || []).some((c) => c.id === o.widget))) continue;
    if (o.op === 'add') {
      if (cfg.widgets.includes(o.widget)) continue;
      cfg.widgets.push(o.widget);
      fresh = o.widget;
    } else if (o.op === 'remove') {
      if (!cfg.widgets.includes(o.widget) || cfg.widgets.length <= 1) continue;
      cfg.widgets = cfg.widgets.filter((w) => w !== o.widget);
      cfg.custom = (cfg.custom || []).filter((c) => c.id !== o.widget);
    } else if (o.op === 'add_custom') {
      const c = sanitizeCustom(o.widget);
      if (!c || (cfg.custom || []).length >= 24) continue;
      c.id = `c_${Math.random().toString(36).slice(2, 10)}`;
      cfg.custom = [...(cfg.custom || []), c];
      cfg.widgets.push(c.id);
      fresh = c.id;
      applied.push({ op: 'add_custom', widget: { id: c.id, title: c.title } });
      continue;
    } else if (o.op === 'style') {
      const st = sanitizeStyle({ ...(cfg.style || {}), ...((o as any).value || {}) });
      if (!st) continue;
      cfg.style = st;
    } else if (o.op === 'style_reset') {
      if (!cfg.style) continue;
      cfg.style = null;
    } else if (o.op === 'move') {
      const i = cfg.widgets.indexOf(o.widget);
      if (i < 0) continue;
      cfg.widgets.splice(i, 1);
      cfg.widgets.splice(Math.max(0, Math.min(cfg.widgets.length, Math.round(Number(o.index) || 0))), 0, o.widget);
      fresh = o.widget;
    } else if (o.op === 'theme') {
      if (!['lumiva', 'bento', 'graphite', 'swiss', 'industry'].includes(o.value)) continue;
      theme = o.value;
    } else if (o.op === 'density') {
      if (!['normal', 'compact', 'large'].includes(o.value)) continue;
      density = o.value;
    } else if (o.op === 'period') {
      if (!['today', '7d', '30d', 'quarter', 'year'].includes(o.value)) continue;
      cfg.period = o.value;
    } else if (o.op === 'title') {
      const v = String(o.value || '').trim().slice(0, 160);
      if (!v) continue;
      title = v;
    } else if (o.op === 'breakdown_add') {
      if (!['manager', 'channel', 'branch', 'product'].includes(o.value) || cfg.breakdown.includes(o.value)) continue;
      cfg.breakdown.push(o.value);
    } else if (o.op === 'breakdown_remove') {
      if (!cfg.breakdown.includes(o.value)) continue;
      cfg.breakdown = cfg.breakdown.filter((b) => b !== o.value);
    } else if (o.op === 'goal') {
      const n = Math.round(Number(o.value));
      if (!(n > 0)) continue;
      cfg.goals = { ...(cfg.goals || {}), team_goal: n };
      if (!cfg.widgets.includes('team_goal')) {
        cfg.widgets.push('team_goal');
        fresh = 'team_goal';
      }
    } else continue;
    applied.push(o);
  }
  return { state: { config: sanitizeAuraConfig(cfg), theme, density, title }, applied, fresh };
}
