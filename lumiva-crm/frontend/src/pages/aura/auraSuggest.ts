import type { TFunction } from 'i18next';
import type { AuraData, AuraTheme, AuraWidgetResult } from '../../api/aura';
import { AU_GLASS, AU_WIDGET, AU_WIDGET_NEEDS, auIsDeco, type AuDraft } from './auraModel';
import type { AuAccess } from './AuraUnlock';

/* Подсказки в чате редактора: строятся из самого дашборда и его данных, применяются сразу (без ИИ).
   Никаких «вечных» одинаковых чипов: тёмную тему не предлагаем тёмному дашборду и т.д. */

export type AuSuggestion = { id: string; label: string; done: string; apply?: (d: AuDraft) => AuDraft; action?: 'goal' };

const DARK = new Set<AuraTheme>(['graphite', 'obsidian', 'nebula']);
/** Блоки, которые не бывают «пустыми» по смыслу. */
const NEVER_EMPTY = new Set(['hero', 'setup', 'pulse', 'team_goal', 'alerts']);

/** Блок без данных за период (или недоступный по правам/ошибке расчёта). */
export function isEmptyResult(key: string, r: AuraWidgetResult | undefined): boolean {
  if (!r || NEVER_EMPTY.has(key) || auIsDeco(key)) return false;
  if ('error' in r) return r.error !== 'locked';
  switch (r.type) {
    case 'kpi':
      return r.value == null || (r.value === 0 && !(r.spark || []).some((x) => x > 0) && !r.delta);
    case 'line':
      return !r.current.some((x) => x > 0) && !r.previous.some((x) => x > 0);
    case 'multi':
      return !r.series.some((s) => s.data.some((x) => x > 0));
    case 'donut':
    case 'bar':
    case 'segbar':
      return !r.items.some((x) => x.value > 0);
    case 'gauge':
      return r.value == null;
    case 'table':
      return !r.rows.length;
    case 'stream':
      return !r.items.length;
    case 'funnel':
      return !r.steps[0]?.value;
    case 'col':
      return !r.data.some((x) => x > 0);
    case 'col2':
      return !r.a.some((x) => x > 0) && !r.b.some((x) => x > 0);
    case 'heat':
      return !r.values.flat().some((x) => x > 0);
    case 'cal':
      return !r.values.some((x) => x > 0);
    case 'split':
      return !r.a.value && !r.b.value;
    case 'forecast':
      return !r.done && !r.prev;
    default:
      return false;
  }
}

export function emptyBlocks(d: AuDraft, data: AuraData | null): string[] {
  if (!data) return [];
  return d.widgets.filter((k) => isEmptyResult(k, data.widgets[k]));
}

const can = (acc: AuAccess, key: string) => {
  const m = AU_WIDGET.get(key);
  if (!m) return false;
  const srcs = [...(m.source !== 'extra' ? [m.source] : []), ...(AU_WIDGET_NEEDS[key] || [])];
  return !srcs.some((s) => acc.lockedSources.has(s as never));
};

export function auraSuggestions(d: AuDraft, data: AuraData | null, t: TFunction, acc: AuAccess): AuSuggestion[] {
  const out: AuSuggestion[] = [];
  const has = (k: string) => d.widgets.includes(k);
  const name = (k: string) => ((d.custom || []).find((c) => c.id === k)?.title || (t(`crm.aura.w.${k}`) as string)).toLowerCase();
  const empties = emptyBlocks(d, data);

  // 1. пустые блоки — самое полезное: дашборд без «нулей»
  if (empties.length && empties.length < d.widgets.length) {
    out.push({
      id: 'drop-empty',
      label: t('crm.aura.sg.dropEmpty', { count: empties.length }),
      done: t('crm.aura.sg.dropEmptyDone', { list: empties.map(name).join(', ') }),
      apply: (p) => ({ ...p, widgets: p.widgets.filter((k) => !empties.includes(k)), custom: (p.custom || []).filter((c) => !empties.includes(c.id)) }),
    });
  }
  // 2. мало данных за короткий период — расширить
  if (data && (d.period === 'today' || d.period === '7d') && empties.length >= Math.ceil(d.widgets.length / 3)) {
    out.push({ id: 'period', label: t('crm.aura.sg.period30'), done: t('crm.aura.sg.periodDone'), apply: (p) => ({ ...p, period: '30d' }) });
  }
  // 3. цель отдела не задана, а блок цели есть
  if (has('team_goal') && !d.goals.team_goal) out.push({ id: 'goal', label: t('crm.aura.sg.goal'), done: '', action: 'goal' });
  // 4. важные блоки, которых нет (только из доступных модулей и с данными по разделам дашборда)
  const want: Array<[string, boolean]> = [
    ['deals_forecast', d.sources.includes('deals')],
    ['leads_src', d.sources.includes('leads')],
    ['compare', d.sources.includes('deals') && !d.widgets.some((k) => AU_WIDGET.get(k)?.type === 'line')],
    ['alerts', d.widgets.length >= 4],
    ['stream', d.widgets.length >= 3 && !d.widgets.some((k) => AU_WIDGET.get(k)?.type === 'stream')],
  ];
  for (const [k, ok] of want) {
    if (out.length >= 4) break;
    if (!ok || has(k) || !can(acc, k)) continue;
    out.push({ id: 'add-' + k, label: t('crm.aura.sg.add', { name: t(`crm.aura.w.${k}`) }), done: t('crm.aura.sg.addDone', { name: t(`crm.aura.w.${k}`) }), apply: (p) => ({ ...p, widgets: [...p.widgets, k] }) });
  }
  // 5. тема — противоположная текущей, в том же «семействе»
  const dark = DARK.has(d.theme);
  const glass = AU_GLASS.has(d.theme);
  const next: AuraTheme = dark ? (glass ? 'frost' : 'lumiva') : glass ? 'obsidian' : 'graphite';
  out.push({
    id: 'theme',
    label: t(dark ? 'crm.aura.sg.light' : 'crm.aura.sg.dark', { name: t(`crm.aura.theme.${next}.name`) }),
    done: t('crm.aura.sg.themeDone', { name: t(`crm.aura.theme.${next}.name`) }),
    apply: (p) => ({ ...p, theme: next }),
  });
  // 6. фильтр по менеджеру для командных дашбордов
  if (out.length < 5 && (d.sources.includes('team') || d.sources.includes('deals')) && !d.breakdown.includes('manager')) {
    out.push({ id: 'filter', label: t('crm.aura.sg.filterManager'), done: t('crm.aura.sg.filterDone'), apply: (p) => ({ ...p, breakdown: [...p.breakdown, 'manager'] }) });
  }
  return out.slice(0, 5);
}

/** Сообщение «собрал» с честным разбором данных. */
export function readyMessage(d: AuDraft, data: AuraData | null, title: string, t: TFunction): string {
  const empties = emptyBlocks(d, data);
  const base = t('crm.aura.sg.ready', { title, count: d.widgets.length });
  if (!data) return base;
  if (!empties.length) return `${base} ${t('crm.aura.sg.allData')}`;
  return `${base} ${t('crm.aura.sg.someEmpty', { count: empties.length, list: empties.map((k) => ((d.custom || []).find((c) => c.id === k)?.title || (t(`crm.aura.w.${k}`, { defaultValue: k }) as string)).toLowerCase()).join(', ') })}`;
}
