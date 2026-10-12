import { Injectable, Logger } from '@nestjs/common';
import { AiAssistantService } from '../ai/ai-assistant.service';
import { AiOpenAiService } from '../ai/ai-openai.service';
import { AiQuotaService } from '../ai/ai-quota.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import {
  AURA_FILTERS,
  AURA_PERIODS,
  AURA_SOURCES,
  AURA_VIEWERS,
  AURA_WIDGETS,
  AURA_WIDGET_BY_KEY,
  auraDefaultWidgets,
  type AuraSourceKey,
} from './aura-catalog';
import { applyEditOps, fallbackAnswer, fallbackBrief, fallbackEditOps, type AuraEditOp, type AuraEditState } from './aura-intent';
import { AURA_DATASETS, AURA_FONTS, sanitizeCustom, type AuraCustomWidget } from './aura-custom';
import { AuraDataService, type AuraViewerInput } from './aura-data.service';

export type AuraAiError = 'provider_quota' | 'tenant_quota' | 'unavailable' | null;

const DATASETS_TEXT = AURA_DATASETS.map(
  (d) => `- ${d.key}: ${d.ai}. Fields: ` + d.fields.map((f) => `${f.key} (${f.kind}${f.values ? `: ${f.values.join('|')}` : ''}) — ${f.ai}`).join('; '),
).join('\n');

const CUSTOM_HELP = `CUSTOM WIDGETS — build any metric from CRM data when no catalog widget fits:
{"op":"add_custom","widget":{"title":"short title in user's language","viz":"kpi|line|bar|donut|table","dataset":"<dataset key or table:<uuid>>","measure":{"agg":"count|sum|avg|min|max","field":"<number/money field, omit for count>"},"filters":[{"field":"<field>","op":"eq|neq|in|contains|gt|gte|lt|lte|empty|notempty","value":"..."}],"groupBy":"<field for bar/donut/table, 'date' for line>","limit":8,"lowerIsBetter":false,"dateField":"<date field key, only for workspace tables>"}}
kpi = one number with trend; line = over time; bar/donut/table = split by groupBy. Use only listed datasets and fields; enum values must match exactly.
Datasets:
${DATASETS_TEXT}`;

const STYLE_HELP = `STYLE — any colors on top of the theme: {"op":"style","value":{"bg":"#hex","surface":"#hex (cards)","ink":"#hex (text on cards)","accent":"#hex (charts/highlights)","accent2":"#hex","radius":0-40,"font":"${AURA_FONTS.join('|')}"}} — only keys you change; {"op":"style_reset"} removes custom colors. Keep text readable (contrast).`;

type Lang = 'ru' | 'en' | 'tr';
const LANG_NAME: Record<Lang, string> = { ru: 'Russian', en: 'English', tr: 'Turkish' };
const normLang = (l?: string): Lang => {
  const v = String(l || '').toLowerCase();
  return v.startsWith('en') ? 'en' : v.startsWith('tr') ? 'tr' : 'ru';
};

const CATALOG_TEXT = AURA_WIDGETS.map((w) => `- ${w.key} [${w.source}, ${w.type}]: ${w.ai}`).join('\n');

function parseJson(raw: string): any {
  const s = String(raw || '').replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

@Injectable()
export class AuraAiService {
  private readonly log = new Logger(AuraAiService.name);

  constructor(
    private readonly assistant: AiAssistantService,
    private readonly openai: AiOpenAiService,
    private readonly quota: AiQuotaService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly data: AuraDataService,
  ) {}

  /** Таблицы рабочей области зрителя — текстом для промпта. */
  private async tablesText(tenantId: string, viewer?: AuraViewerInput) {
    if (!viewer) return '';
    try {
      const scope = await this.data.buildScope(tenantId, viewer);
      const tables = await this.data.workspaceTables(scope);
      if (!tables.length) return '';
      return (
        '\nWorkspace tables (dataset "table:<id>"; field kinds: number → sum/avg, others → filters/groupBy; date fields → dateField):\n' +
        tables
          .slice(0, 30)
          .map((t) => `- table:${t.id} "${t.name}": ` + t.fields.slice(0, 40).map((f) => `${f.key} [${f.type}] "${f.label}"`).join('; '))
          .join('\n')
      );
    } catch {
      return '';
    }
  }

  /** Один JSON-запрос к модели: свой ключ клиента (BYOK) или платформенный с квотой. null — ИИ недоступен. */
  private async ask(tenantId: string, userId: string, system: string, user: string): Promise<{ res: any | null; err: AuraAiError }> {
    try {
      const override = await this.assistant.resolveTenantOpenAiOverride(tenantId);
      if (!override) {
        const q = await this.quota.getQuotaSnapshot(tenantId);
        if (q.totalAvailableCents <= 0) return { res: null, err: 'tenant_quota' };
      }
      const { message, usage } = await this.openai.chatCompletionWithConfig(
        {
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          jsonMode: override?.provider !== 'anthropic',
          temperatureOverride: 0.2,
          timeoutMs: 45_000,
        },
        override,
      );
      if (!override) {
        const cfg = await this.platformSettings.getSettings().catch(() => null);
        const cost = this.openai.estimateCostCents(
          usage.prompt_tokens || 0,
          usage.completion_tokens || 0,
          parseFloat(cfg?.aiPriceInputPerMtokUsd?.trim() || '0.15'),
          parseFloat(cfg?.aiPriceOutputPerMtokUsd?.trim() || '0.6'),
        );
        await this.quota
          .chargeCents(tenantId, cost, { userId, kind: 'chat', model: cfg?.openAiModel || null, promptTokens: usage.prompt_tokens || 0, completionTokens: usage.completion_tokens || 0 })
          .catch(() => undefined);
      }
      return { res: parseJson(String(message.content || '')), err: null };
    } catch (e) {
      const msg = (e as Error).message || '';
      this.log.warn(`aura ai failed for ${tenantId}: ${msg}`);
      return { res: null, err: /credit|quota|insufficient|billing|429/i.test(msg) ? 'provider_quota' : 'unavailable' };
    }
  }

  /* ---------- бриф ---------- */

  async brief(tenantId: string, userId: string, prompt: string, lang?: string, viewer?: AuraViewerInput) {
    const fb = fallbackBrief(prompt);
    const L = normLang(lang);
    const text = String(prompt || '').slice(0, 2000);
    const { res, err } = await this.ask(
      tenantId,
      userId,
      `You configure a business dashboard app ("Aura") on live CRM data. Pick data from this catalog only.
Sources: ${AURA_SOURCES.join(', ')}.
Widgets (key [source, type]: meaning):
${CATALOG_TEXT}
Periods: ${AURA_PERIODS.join(', ')}. Breakdown filters: ${AURA_FILTERS.join(', ')}. Viewers: ${AURA_VIEWERS.join(', ')}.
Return JSON: {"sources":[...],"widgets":[4-9 keys in display order, KPIs first],"custom":[custom widget objects, see below — only for needs the catalog can't cover],"period":"...","breakdown":[...],"viewer":"..."|null,"title":"short app title in ${LANG_NAME[L]} (2-4 words)"}.
Only choose widgets that answer the user's request. Use "tv" viewer only for office screens/TV.
${CUSTOM_HELP.replace('{"op":"add_custom","widget":', '').replace(/\}\}\n/, '}\n')}${await this.tablesText(tenantId, viewer)}`,
      text,
    );
    if (!res) return { ...fb, custom: [] as AuraCustomWidget[], ai: false, aiError: err };
    const sources = (Array.isArray(res.sources) ? res.sources : []).filter((s: string) => (AURA_SOURCES as string[]).includes(s)) as AuraSourceKey[];
    let widgets = (Array.isArray(res.widgets) ? res.widgets : []).map(String).filter((k: string) => AURA_WIDGET_BY_KEY.has(k));
    const srcFinal: AuraSourceKey[] = sources.length ? sources : fb.sources;
    for (const k of widgets) {
      const s = AURA_WIDGET_BY_KEY.get(k)!.source;
      if (s !== 'extra' && !srcFinal.includes(s)) srcFinal.push(s);
    }
    if (!widgets.length) widgets = auraDefaultWidgets(srcFinal);
    return {
      sources: srcFinal,
      widgets: [...new Set(widgets)].slice(0, 12),
      period: (AURA_PERIODS as string[]).includes(res.period) ? res.period : fb.period,
      breakdown: (Array.isArray(res.breakdown) ? res.breakdown : []).filter((b: string) => (AURA_FILTERS as string[]).includes(b)),
      viewer: (AURA_VIEWERS as string[]).includes(res.viewer) ? res.viewer : fb.viewer,
      title: typeof res.title === 'string' ? res.title.trim().slice(0, 80) : '',
      custom: (Array.isArray(res.custom) ? res.custom : [])
        .map((c: unknown) => sanitizeCustom({ ...(c as object), id: undefined }))
        .filter((c: AuraCustomWidget | null): c is AuraCustomWidget => !!c)
        .slice(0, 8),
      ai: true,
      aiError: null as AuraAiError,
    };
  }

  /** Ответ «своими словами» на вопрос брифа → выбранные варианты. */
  async answer(tenantId: string, userId: string, questionId: string, text: string, options: string[]) {
    const opts = (Array.isArray(options) ? options : []).map(String).slice(0, 60);
    const fb = fallbackAnswer(questionId, text, opts);
    const described = opts.map((o) => `- ${o}${AURA_WIDGET_BY_KEY.get(o) ? `: ${AURA_WIDGET_BY_KEY.get(o)!.ai}` : ''}`).join('\n');
    const { res, err } = await this.ask(
      tenantId,
      userId,
      `Map a free-text answer to option keys of a dashboard setup question "${questionId}". Options:
${described}
Return JSON {"values":[option keys]}; [] if nothing matches. Never invent keys.`,
      String(text || '').slice(0, 500),
    );
    const vals = res && Array.isArray(res.values) ? res.values.map(String).filter((v: string) => opts.includes(v)) : null;
    return { values: vals && vals.length ? vals : fb, ai: !!vals, aiError: vals ? null : err };
  }

  /* ---------- правки в редакторе ---------- */

  async edit(tenantId: string, userId: string, state: AuraEditState, message: string, lang?: string, viewer?: AuraViewerInput) {
    const L = normLang(lang);
    const text = String(message || '').slice(0, 1000);
    const { res, err } = await this.ask(
      tenantId,
      userId,
      `You edit a dashboard app ("Aura") built on live CRM data. The user writes what to change.
Widget catalog (key [source, type]: meaning):
${CATALOG_TEXT}
Current state: ${JSON.stringify({ widgets: state.config.widgets, custom: (state.config.custom || []).map((c) => ({ id: c.id, title: c.title, viz: c.viz, dataset: c.dataset })), style: state.config.style || null, period: state.config.period, breakdown: state.config.breakdown, goal: state.config.goals?.team_goal ?? null, theme: state.theme, density: state.density, title: state.title })}
Allowed operations:
{"op":"add","widget":KEY} {"op":"remove","widget":KEY} {"op":"move","widget":KEY,"index":N}
{"op":"theme","value":"lumiva|bento|graphite|swiss|industry"} (graphite = dark, for TV; bento = colorful tiles; swiss = contrast blue; industry = blueprint)
{"op":"density","value":"normal|compact|large"} {"op":"period","value":"${AURA_PERIODS.join('|')}"}
{"op":"title","value":TEXT} {"op":"breakdown_add|breakdown_remove","value":"${AURA_FILTERS.join('|')}"} {"op":"goal","value":NUMBER (monthly revenue goal in main currency)}
To change a custom widget: remove it by id and add a new one.
${STYLE_HELP}
${CUSTOM_HELP}${await this.tablesText(tenantId, viewer)}
Return JSON {"ops":[...],"reply":"1-2 short sentences in ${LANG_NAME[L]} saying what you changed, or — if the request can't be done with these operations or data isn't in the catalog — say so honestly and suggest what is possible"}.
Do whatever the user asks if it can be expressed with these operations (colors, layout, any metric from the datasets). Never claim a change you did not put into ops. Data cannot be invented or edited — only displayed.`,
      text,
    );
    let ops: AuraEditOp[] = [];
    let reply: string | null = null;
    let ai = false;
    if (res && Array.isArray(res.ops)) {
      ops = res.ops;
      reply = typeof res.reply === 'string' ? res.reply.trim().slice(0, 600) : null;
      ai = true;
    } else {
      ops = fallbackEditOps(text, state);
    }
    const out = applyEditOps(state, ops);
    // модель могла заявить изменения, которые не прошли проверку — тогда её текст не показываем
    if (ai && ops.length && out.applied.length < ops.length) reply = null;
    return { ...out.state, applied: out.applied, fresh: out.fresh, reply, ai, aiError: ai ? null : err };
  }
}
