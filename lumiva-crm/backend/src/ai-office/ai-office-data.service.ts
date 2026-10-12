import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AiToolsService } from '../ai/ai-tools.service';
import { AiDepartment } from './ai-department.entity';
import { ot } from './ai-office-i18n';
import { brainSuppliers, queryStock, stockTable } from './ai-office-stock';
import { bookingKindOf, receptionPack } from './ai-office-reception';
import { financePack } from './ai-office-finance';
import { ESCALATE_RE } from './ai-office-escalate';

/** Зона отдела — по ней решаем, какие данные ему положены и чья это задача. */
export const OFFICE_AREAS = ['sales', 'marketing', 'content', 'ops', 'finance', 'stock', 'dev', 'support', 'reception'] as const;
export type OfficeArea = (typeof OFFICE_AREAS)[number];

/** Рекламные интеграции и коннектор отдела, который даёт к ним доступ (null — коннектора нет, доступ по зоне). */
const AD_PROVIDERS: Record<string, string | null> = { meta_ads: 'meta_ads', google_ads: 'google_ads', yandex_direct: null, vk_ads: null };
const AD_NAMES: Record<string, string> = { meta_ads: 'Meta Ads', google_ads: 'Google Ads', yandex_direct: 'Яндекс Директ', vk_ads: 'VK Реклама' };

/** Задача про рекламу (без этих данных её не сделать) — ru/en/tr. */
const ADS_TASK_RE = /реклам|кампани|бюджет|ROI|ROAS|CPC|CPL|CTR|CPM|трафик|креатив|объявлен|ads?\b|campaign|budget|spend|traffic|reklam|kampanya|bütçe|trafik/i;

export type DataSourceState = {
  key: 'ads';
  /** ok — данные есть; grant — интеграция подключена, но отделу не открыта (одна кнопка); connect — интеграции нет */
  status: 'ok' | 'grant' | 'connect';
  /** что включить отделу при «Предоставить доступ» */
  grantConnectors: string[];
  names: string[];
};

export type DataPack = {
  area: OfficeArea | null;
  /** блок для промпта: сами данные + что доступно/чего нет */
  block: string;
  /** проверка «моя ли это задача» — ставится в самое начало задачи */
  scope: string;
  /** проверенные цифры (markdown) — система сама ставит их в начало отчёта, модель их не пересчитывает */
  factsMd: string;
  /** что реально прочитано — показываем в карточке задачи («Данные») */
  used: Array<{ key: string; label: string; period?: string }>;
  missing: DataSourceState[];
};

const day = (d: Date) => d.toISOString().slice(0, 10);

/** «Нужна ваша помощь» для недостающих данных зоны: открыть отделу (grant) или подключить кабинет (connect). */
export function accessIssueText(lang: 'ru' | 'en' | 'tr', src: DataSourceState) {
  const grant = src.status === 'grant';
  return {
    fix: grant ? ('grant' as const) : ('connect' as const),
    title: ot(lang, grant ? 'issue_data_grant_title' : 'issue_data_connect_title', { names: src.names.join(', ') }),
    detail: ot(lang, grant ? 'issue_data_grant_detail' : 'issue_data_connect_detail'),
  };
}

/** Что входит в зону каждого отдела — по этому модель решает «моя задача или чужая». */
export const AREA_SCOPE: Record<OfficeArea, string> = {
  sales: 'leads, deals, clients, replies to clients, follow-ups, quotes/offers, meetings with clients',
  marketing: 'advertising (Meta/Google/Yandex/VK ads), campaigns, ad budgets, traffic and channels, UTM, audiences, SEO, marketing analytics and ROI of channels',
  content: 'posts, articles, newsletters, scripts, texts for creatives, content plans',
  ops: 'internal processes, team tasks, deadlines, workload, regulations, daily operations',
  finance: 'invoices, payments, revenue, debts, expenses, financial reports',
  stock: 'products, stock levels, suppliers, purchase orders, warehouse',
  dev: 'website/app bugs, code, repositories, technical tasks',
  reception: 'bookings and hotel reservations: confirmations, reminders before the visit, no-shows, rescheduling, guest messages about their booking, review requests after the visit',
  support: 'helpdesk tickets of existing clients and staff: questions, complaints, how-to help, problem resolution, ticket status',
};

@Injectable()
export class AiOfficeDataService {
  private readonly log = new Logger(AiOfficeDataService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly tools: AiToolsService,
  ) {}

  areaOf(dept: Pick<AiDepartment, 'templateKey' | 'connectors'>): OfficeArea | null {
    if (dept.templateKey && (OFFICE_AREAS as readonly string[]).includes(dept.templateKey)) return dept.templateKey as OfficeArea;
    if (dept.connectors.some((c) => c === 'meta_ads' || c === 'google_ads')) return 'marketing';
    return null;
  }

  /** Источники данных зоны отдела и их доступность. */
  async sources(dept: AiDepartment): Promise<DataSourceState[]> {
    const area = this.areaOf(dept);
    if (area !== 'marketing') return [];
    const rows: Array<{ provider: string }> = await this.db.query(
      `SELECT DISTINCT provider FROM marketing_integrations WHERE "tenantId" = $1 AND "isActive" = true AND provider = ANY($2)`,
      [dept.tenantId, Object.keys(AD_PROVIDERS)],
    );
    const active = rows.map((r) => r.provider);
    const open = active.filter((p) => !AD_PROVIDERS[p] || dept.connectors.includes(AD_PROVIDERS[p]!));
    const status: DataSourceState['status'] = open.length ? 'ok' : active.length ? 'grant' : 'connect';
    return [
      {
        key: 'ads',
        status,
        grantConnectors: [...new Set(active.map((p) => AD_PROVIDERS[p]).filter((c): c is string => !!c))],
        names: (status === 'ok' ? open : active.length ? active : ['meta_ads', 'google_ads']).map((p) => AD_NAMES[p] ?? p),
      },
    ];
  }

  /** Агент просит у владельца данные своей зоны (расходы на рекламу и т.п.) — какой это источник. */
  async matchSource(dept: AiDepartment, text: string): Promise<DataSourceState | null> {
    if (!ADS_TASK_RE.test(text)) return null;
    return (await this.sources(dept)).find((s) => s.key === 'ads') ?? null;
  }

  /** Задача без этих данных невыполнима (до вызова модели — чтобы не тратить деньги впустую). */
  needsBeforeRun(missing: DataSourceState[], text: string): DataSourceState | null {
    return missing.find((m) => m.key === 'ads' && ADS_TASK_RE.test(text)) ?? null;
  }

  private async tool(dept: AiDepartment, name: string, args: Record<string, unknown>, max = 6000): Promise<string | null> {
    try {
      const out = await this.tools.execute(name, JSON.stringify(args), { tenantId: dept.tenantId, userId: dept.createdBy ?? '', userRole: 'owner', staffUserId: null });
      if (!out || /"error"\s*:/.test(out.slice(0, 200))) return null;
      const json = JSON.stringify(this.compact(name, JSON.parse(out)));
      return json.length > max ? `${json.slice(0, max)}…(truncated)` : json;
    } catch (e) {
      this.log.warn(`data ${name} dept=${dept.id}: ${(e as Error).message}`);
      return null;
    }
  }

  /** Оставляем то, на чём строится анализ: итоги, разбивка по кабинетам, топ кампаний/рынков — без служебных списков. */
  private compact(name: string, d: any): unknown {
    if (!d || typeof d !== 'object') return d;
    const round = (v: unknown) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);
    const row = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'rowCount').map(([k, v]) => [k, round(v)]));
    if (name === 'crm_marketing_overview') {
      const { dataSources: _ds, providerBreakdown, topChannels, ...rest } = d;
      void topChannels; // кампании с конверсиями берём своим запросом (adResults)
      return { ...rest, byAccount: (providerBreakdown ?? []).map(row) };
    }
    if (name === 'crm_marketing_markets') {
      return { ...d, markets: (d.markets ?? []).slice(0, 12).map(row) };
    }
    return d;
  }

  /**
   * Результат рекламы по данным самих площадок: конверсии и их ценность (бронирования/покупки/заявки на сайте).
   * В общем обзоре CRM их нет — без них отдел делает вывод «лидов 0 — бюджет впустую».
   */
  private async adResults(tenantId: string, from: string, to: string, labels: Record<string, string> = {}) {
    const num = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100;
    const acc: any[] = await this.db.query(
      `SELECT "dataSource" AS src, currency, sum(cost) cost, sum(clicks) clicks, sum(impressions) impressions, sum(conversions) conv, sum("allConversions") all_conv, sum("conversionValue") conv_value, sum(revenue) revenue
         FROM marketing_traffic WHERE "tenantId" = $1 AND date BETWEEN $2 AND $3 GROUP BY 1, 2 ORDER BY sum(cost) DESC, sum(conversions) DESC LIMIT 20`,
      [tenantId, from, to],
    );
    const camp: any[] = await this.db.query(
      `SELECT "dataSource" AS src, campaign, currency, sum(cost) cost, sum(clicks) clicks, sum(conversions) conv, sum("allConversions") all_conv, sum("conversionValue") conv_value
         FROM marketing_traffic WHERE "tenantId" = $1 AND date BETWEEN $2 AND $3 AND cost > 0 GROUP BY 1, 2, 3 ORDER BY sum(cost) DESC LIMIT 20`,
      [tenantId, from, to],
    );
    const roas = (v: number, c: number) => (c > 0 && v > 0 ? Math.round((v / c) * 100) / 100 : null);
    // итоги по площадке (google_ads / meta_ads / ga4 …) и валюте — считаем сами, чтобы модель не складывала цифры
    const plat = new Map<string, { platform: string; currency: string; cost: number; clicks: number; conversions: number; allConversions: number; conversionValue: number; revenue: number }>();
    for (const r of acc) {
      const platform = String(r.src ?? '').replace(/_[^_]*\d[^_]*$/, '').replace(/_act$/, '') || 'other';
      const k = `${platform}|${r.currency}`;
      const t = plat.get(k) ?? { platform, currency: r.currency, cost: 0, clicks: 0, conversions: 0, allConversions: 0, conversionValue: 0, revenue: 0 };
      t.cost += num(r.cost);
      t.clicks += num(r.clicks);
      t.conversions += num(r.conv);
      t.allConversions += Math.max(num(r.all_conv), num(r.conv));
      t.conversionValue += num(r.conv_value);
      t.revenue += num(r.revenue);
      plat.set(k, t);
    }
    const name = (src: string) => labels[src] || src;
    return {
      byPlatform: [...plat.values()].map((t) => ({ ...t, cost: num(t.cost), conversionValue: num(t.conversionValue), revenue: num(t.revenue), roas: roas(t.conversionValue, t.cost), costPerConversion: t.conversions > 0 ? num(t.cost / t.conversions) : null })),
      byAccount: acc.map((r) => ({ account: name(r.src), currency: r.currency, cost: num(r.cost), clicks: num(r.clicks), impressions: num(r.impressions), conversions: num(r.conv), conversionValue: num(r.conv_value), revenue: num(r.revenue), roas: roas(num(r.conv_value), num(r.cost)) })),
      topCampaignsByCost: camp.map((r) => ({ account: name(r.src), campaign: r.campaign, currency: r.currency, cost: num(r.cost), clicks: num(r.clicks), conversions: num(r.conv), allConversions: Math.max(num(r.all_conv), num(r.conv)), conversionValue: num(r.conv_value), roas: roas(num(r.conv_value), num(r.cost)), costPerConversion: num(r.conv) > 0 ? num(num(r.cost) / num(r.conv)) : null })),
    };
  }

  /** Данные зоны отдела на сегодня: последние 30 дней + предыдущие 30 для сравнения. */
  /** Таблица ключевых цифр рекламы — считаем сами, без модели. */
  private factsTable(lang: 'ru' | 'en' | 'tr', cur: Awaited<ReturnType<AiOfficeDataService['adResults']>>, prev: Awaited<ReturnType<AiOfficeDataService['adResults']>> | null, period: string) {
    const L = {
      ru: { all: 'все', h: 'Ключевые цифры рекламы', note: 'посчитано системой по данным кабинетов', plat: 'Площадка', cost: 'Расход', conv: 'Конверсии', val: 'Ценность конверсий', roas: 'ROAS', cpa: 'Цена конверсии', top: 'Кампании с наибольшим расходом', camp: 'Кампания', vs: 'к пред. 30 дн' },
      en: { all: 'all', h: 'Key ad numbers', note: 'computed by the system from the ad accounts', plat: 'Platform', cost: 'Spend', conv: 'Conversions', val: 'Conversion value', roas: 'ROAS', cpa: 'Cost per conversion', top: 'Top campaigns by spend', camp: 'Campaign', vs: 'vs prev. 30 d' },
      tr: { all: 'tümü', h: 'Reklam temel rakamları', note: 'reklam hesaplarından sistem tarafından hesaplandı', plat: 'Platform', cost: 'Harcama', conv: 'Dönüşüm', val: 'Dönüşüm değeri', roas: 'ROAS', cpa: 'Dönüşüm başı maliyet', top: 'En çok harcayan kampanyalar', camp: 'Kampanya', vs: 'önceki 30 güne göre' },
    }[lang];
    const PL: Record<string, string> = { google_ads: 'Google Ads', meta_ads: 'Meta Ads', ga4: 'GA4', yandex_direct: 'Яндекс Директ', vk_ads: 'VK Реклама' };
    const loc = lang === 'ru' ? 'ru-RU' : lang === 'tr' ? 'tr-TR' : 'en-US';
    const n = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? '—' : v.toLocaleString(loc, { maximumFractionDigits: d }));
    const pct = (a: number, b: number | undefined) => (b && b > 0 ? ` (${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%)` : '');
    const rows = cur.byPlatform.filter((p) => p.cost > 0 || p.conversions > 0);
    if (!rows.length) return '';
    const lines = [`### ${L.h}`, `_${period} · ${L.note}; (%) — ${L.vs}_`, '', `| ${L.plat} | ${L.cost} | ${L.conv} | ${L.val} | ${L.roas} | ${L.cpa} |`, '|---|---|---|---|---|---|'];
    for (const p of rows) {
      const pp = prev?.byPlatform.find((x) => x.platform === p.platform && x.currency === p.currency);
      const spend = p.cost > 0 ? `${n(p.cost)} ${p.currency}${pct(p.cost, pp?.cost)}` : '—';
      const cpa = p.cost > 0 && p.costPerConversion !== null ? `${n(p.costPerConversion, 2)} ${p.currency}` : '—';
      lines.push(`| ${PL[p.platform] ?? p.platform}${p.cost > 0 ? '' : ` (${p.currency})`} | ${spend} | ${n(p.conversions)}${pct(p.conversions, pp?.conversions)}${p.allConversions > p.conversions ? ` · ${L.all} ${n(p.allConversions)}` : ''} | ${p.conversionValue ? `${n(p.conversionValue)} ${p.currency}` : '—'} | ${n(p.roas, 2)} | ${cpa} |`);
    }
    const top = cur.topCampaignsByCost.slice(0, 8);
    if (top.length) {
      lines.push('', `**${L.top}**`, '', `| ${L.camp} | ${L.cost} | ${L.conv} | ${L.roas} | ${L.cpa} |`, '|---|---|---|---|---|');
      for (const c of top) lines.push(`| ${String(c.campaign || '—').replace(/\|/g, '/')} | ${n(c.cost)} ${c.currency} | ${n(c.conversions)}${c.allConversions > c.conversions ? ` · ${L.all} ${n(c.allConversions)}` : ''} | ${n(c.roas, 2)} | ${c.costPerConversion !== null ? `${n(c.costPerConversion, 2)} ${c.currency}` : '—'} |`);
    }
    return lines.join('\n');
  }

  /** Заявки helpdesk: эта заявка целиком + очередь открытых с последними сообщениями. */
  private async supportPack(tenantId: string, ticketId: string | null): Promise<string> {
    const clip = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
    const out: string[] = [];
    if (ticketId) {
      const [t] = await this.db.query(
        `SELECT h.id, h.subject, h.status, h.priority, h.channel, h.category, h."assignedUserId", h."requesterName", h."createdAt",
                c.id contact_id, COALESCE(NULLIF(c."fullName", ''), concat_ws(' ', c."firstName", c."lastName")) contact, c.email, c.phone,
                (SELECT count(*) FROM sales s WHERE s.contact_id = c.id) sales_n,
                (SELECT max(s."saleDate") FROM sales s WHERE s.contact_id = c.id) last_sale
           FROM helpdesk_tickets h LEFT JOIN contacts c ON c.id = h."contactId"
          WHERE h."tenantId" = $1 AND h.id::text = $2`,
        [tenantId, ticketId],
      );
      if (t) {
        const msgs: any[] = await this.db.query(
          `SELECT direction, "authorName" author, text, "createdAt" at FROM helpdesk_ticket_messages WHERE "tenantId" = $1 AND "ticketId" = $2 ORDER BY "createdAt" DESC LIMIT 30`,
          [tenantId, t.id],
        );
        // возврат / жалоба / юристы — решает человек; флаг ставит система, а не модель «по ощущению»
        const lastIn = msgs.find((m) => m.direction === 'incoming');
        const escalate = lastIn && ESCALATE_RE.test(String(lastIn.text ?? ''));
        out.push(
          (escalate
            ? 'SYSTEM FLAG: the client\'s last message is about a refund / complaint / legal matter. You MUST call helpdesk_update with priority "high" and assignedUserId of a human (snapshot.channels.staff), and reply only that a specialist took the ticket — promise nothing (no refund, no compensation, no dates).\n'
            : '') +
          `THIS TICKET ${t.id} — "${clip(t.subject, 200)}" · status ${t.status} · priority ${t.priority} · channel ${t.channel}${t.category ? ` · category ${t.category}` : ''} · assignedUserId ${t.assignedUserId ?? 'nobody'}\n` +
            `Client: ${t.contact_id ? `${clip(t.contact, 80)} (contact ${t.contact_id}), ${t.sales_n} sales${t.last_sale ? `, last ${String(t.last_sale).slice(0, 10)}` : ''}` : `${clip(t.requesterName, 80)} (staff member, internal request)`}\n` +
            `Conversation (oldest first; "in" = from the client, "out" = from us):\n` +
            msgs.reverse().map((m) => `[${new Date(m.at).toISOString().slice(0, 16).replace('T', ' ')}] ${m.direction === 'incoming' ? 'in' : 'out'} ${clip(m.author, 40)}: ${clip(m.text, 1500)}`).join('\n'),
        );
      }
    }
    // задача про конкретную заявку — только она (очередь путает модель)
    if (ticketId && out.length) return `HELPDESK (the ticket of this task; reply only with helpdesk_reply to THIS ticket id; never invent facts — answers come from the Brain knowledge base and the conversation):\n${out.join('\n\n')}`;
    const queue: any[] = await this.db.query(
      `SELECT h.id, h.subject, h.status, h.priority, h.channel, h."assignedUserId",
              lm.direction last_dir, lm.text last_text, lm."createdAt" last_at,
              floor(extract(epoch FROM now() - lm."createdAt") / 3600)::int hours
         FROM helpdesk_tickets h
         LEFT JOIN LATERAL (SELECT direction, text, "createdAt" FROM helpdesk_ticket_messages m WHERE m."ticketId" = h.id ORDER BY "createdAt" DESC LIMIT 1) lm ON true
        WHERE h."tenantId" = $1 AND h.status IN ('open','pending')
        ORDER BY (lm.direction = 'incoming') DESC, lm."createdAt" ASC NULLS LAST LIMIT 20`,
      [tenantId],
    );
    if (queue.length) {
      const waiting = queue.filter((q) => q.last_dir === 'incoming');
      out.push(
        `OPEN TICKETS: ${queue.length}${queue.length === 20 ? '+' : ''}; waiting for OUR reply: ${waiting.length}${waiting.length ? ` (longest ${Math.max(...waiting.map((w) => w.hours))} h)` : ''}.\n` +
          queue.map((q) => `- ${q.id} "${clip(q.subject, 120)}" · ${q.status} · ${q.priority} · ${q.channel} · ${q.last_dir === 'incoming' ? `client waits ${q.hours} h` : 'we replied last'} · last: ${clip(q.last_text, 160)}`).join('\n'),
      );
    } else if (!out.length) out.push('OPEN TICKETS: none.');
    return `HELPDESK (real tickets; reply only with helpdesk_reply to the ticket id; never invent facts — answers come from the Brain knowledge base and the conversation):\n${out.join('\n\n')}`;
  }

  async load(dept: AiDepartment, lang: 'ru' | 'en' | 'tr' = 'en', task?: { entityType?: string | null; entityId?: string | null }): Promise<DataPack> {
    const area = this.areaOf(dept);
    const src = await this.sources(dept);
    const missing = src.filter((s) => s.status !== 'ok');
    const used: DataPack['used'] = [];
    let factsMd = '';
    const parts: string[] = [];
    const now = new Date();
    const from = new Date(now.getTime() - 29 * 86400_000);
    const prevTo = new Date(from.getTime() - 86400_000);
    const prevFrom = new Date(prevTo.getTime() - 29 * 86400_000);
    const period = `${day(from)} — ${day(now)}`;

    const ads = src.find((s) => s.key === 'ads');
    if (ads?.status === 'ok') {
      const [cur, prev, markets] = await Promise.all([
        this.tool(dept, 'crm_marketing_overview', { from: day(from), to: day(now) }, 9000),
        this.tool(dept, 'crm_marketing_overview', { from: day(prevFrom), to: day(prevTo) }, 5000),
        this.tool(dept, 'crm_marketing_markets', { from: day(from), to: day(now) }, 4000),
      ]);
      const labels: Record<string, string> = {};
      try {
        for (const a of (JSON.parse(cur ?? '{}').byAccount ?? []) as Array<{ dataSource?: string; label?: string }>) if (a.dataSource && a.label) labels[a.dataSource] = a.label;
      } catch {
        /* без подписей — останутся id кабинетов */
      }
      const [resCur, resPrev] = await Promise.all([
        this.adResults(dept.tenantId, day(from), day(now), labels).catch(() => null),
        this.adResults(dept.tenantId, day(prevFrom), day(prevTo), labels).catch(() => null),
      ]);
      if (resCur) {
        factsMd = this.factsTable(lang, resCur, resPrev, period);
        parts.push(
          `AD RESULTS reported by the ad platforms / GA4 (conversions = bookings/purchases/leads tracked on the site; conversionValue = their value; roas = conversionValue / cost, same currency) — last 30 days (${period}):\n${JSON.stringify(resCur)}` +
            (resPrev ? `\nPrevious 30 days (${day(prevFrom)} — ${day(prevTo)}) by platform: ${JSON.stringify(resPrev.byPlatform)}` : '') +
            `\nA verified "key numbers" table built from exactly this data is attached to your report automatically — do NOT repeat totals tables; write the analysis, findings and recommendations, and copy any number you cite exactly from the data.` +
            `\nPlatform conversions are ACTIONS (form sends, calls, booking-engine clicks), NOT paying clients: never call cost per conversion a "CAC" and never treat conversions as customers. Real CAC = ad spend / new paying clients from CRM sales linked to the channel — if CRM sales are empty or not linked to channels, say CAC cannot be computed and report cost per conversion instead. Never invent targets/thresholds that are not in DEPARTMENT DATA or the Brain. allConversions = all conversions incl. secondary ones (Google: booking-engine clicks, calls etc.) — a campaign with conversions 0 but allConversions > 0 is NOT empty. HOW TO READ: use the byPlatform totals as they are (they are already summed — never re-add accounts yourself). Judge ad efficiency by platform conversions, conversionValue, ROAS and cost per conversion. CRM leads/sales are often 0 only because this business does not record them in the CRM — NEVER conclude "no results / budget wasted" from CRM zeros when platform conversions exist; mention the missing CRM tracking as a separate note instead. Compare currencies only within the same currency. These numbers are fresh: when they contradict Brain notes or earlier findings of the department, the fresh numbers win — never repeat an old figure that is not in this data.`,
        );
      }
      if (cur || resCur) {
        if (cur) parts.push(`ADS — last 30 days (${period}):\n${cur}`);
        if (prev) parts.push(`ADS — previous 30 days (${day(prevFrom)} — ${day(prevTo)}), for comparison:\n${prev}`);
        if (markets) parts.push(`ADS — by market/country (${period}):\n${markets}`);
        used.push({ key: 'ads', label: ads.names.join(', '), period });
      }
    }
    // склад: остатки и расход — отделу склада или любому отделу, которому открыта категория «Склад»
    if (area === 'stock' || (area !== 'reception' && dept.permissions?.stock && dept.permissions.stock !== 'off')) {
      try {
        const st = await queryStock(this.db, dept.tenantId);
        if (st.total > 0) {
          const t = stockTable(lang, st.rows);
          factsMd = factsMd ? `${factsMd}\n\n${t}` : t;
          parts.push(
            `STOCK — ${st.total} tracked items; ${st.rows.length} need attention (out of stock / below threshold / run out within 14 days at the 30-day pace). ` +
              `Computed by the system: out30 = units sold/used in 30 days, perDay, daysLeft, suggestQty = reorder quantity to cover 30 days (min 2× threshold). ` +
              `A verified stock table is attached to your report automatically — do not retype it; use suggestQty unless you have a reason from the data, and never invent stock numbers.\n${JSON.stringify(st.rows)}`,
          );
          used.push({ key: 'stock', label: 'stock', period });
          const sup = await brainSuppliers(this.db, dept.tenantId, dept.id).catch(() => '');
          parts.push(
            sup
              ? `SUPPLIERS (from the company Brain — the only valid source of supplier emails):\n${sup}`
              : 'SUPPLIERS: the Brain has no supplier list with emails — for purchase orders ask the owner via office_request_help (kind "data") to upload one.',
          );
        } else {
          parts.push('STOCK — the company has no products with stock tracking in the CRM (Products module is empty).');
        }
      } catch (e) {
        this.log.warn(`stock pack dept=${dept.id}: ${(e as Error).message}`);
      }
    }
    // финансы: дебиторка, платежи, возвраты, реклама как единственный известный расход, сверка
    if (area === 'finance') {
      try {
        const fin = await financePack(this.db, dept.tenantId, lang);
        parts.push(fin.block);
        if (fin.factsMd) factsMd = factsMd ? `${factsMd}\n\n${fin.factsMd}` : fin.factsMd;
        used.push({ key: 'finance', label: 'finance', period });
      } catch (e) {
        this.log.warn(`finance pack dept=${dept.id}: ${(e as Error).message}`);
      }
    }
    // ресепшн: ближайшие брони/заезды и бронь задачи (время — в поясе отдела)
    const bk = bookingKindOf(task?.entityType);
    if (area === 'reception' || (bk && task?.entityId)) {
      try {
        parts.push(await receptionPack(this.db, dept.tenantId, dept.timezone || 'UTC', bk && task?.entityId ? { kind: bk, id: task.entityId } : null));
        used.push({ key: 'bookings', label: 'bookings' });
      } catch (e) {
        this.log.warn(`reception pack dept=${dept.id}: ${(e as Error).message}`);
      }
    }
    // поддержка: заявки с перепиской (а не только темы), ожидание ответа считает система
    if (area === 'support' || (task?.entityType === 'helpdesk_ticket' && task.entityId)) {
      try {
        const sup = await this.supportPack(dept.tenantId, task?.entityType === 'helpdesk_ticket' ? task.entityId ?? null : null);
        if (sup) {
          parts.push(sup);
          used.push({ key: 'helpdesk', label: 'helpdesk' });
        }
      } catch (e) {
        this.log.warn(`support pack dept=${dept.id}: ${(e as Error).message}`);
      }
    }
    if (area === 'sales' || area === 'finance' || area === 'marketing') {
      const sales = await this.tool(dept, 'crm_sales_summary', { from: day(from), to: day(now) }, 3000);
      if (sales) {
        parts.push(`SALES — last 30 days (${period}):\n${sales}`);
        used.push({ key: 'sales', label: 'sales', period });
      }
    }

    const scope = area
        ? `SCOPE CHECK — do this FIRST: your department area is "${area}" (${AREA_SCOPE[area]}). Other areas: ${OFFICE_AREAS.filter((a) => a !== area).map((a) => `${a} (${AREA_SCOPE[a]})`).join('; ')}. If the task is mainly about another area, set "outOfScope" with that area and return no actions — do NOT request data, uploads or access for it, and do NOT reinterpret it into a task of your own area. Judge by what must be DONE, not by words: calling or messaging leads/clients and booking meetings is sales; checking stock and ordering from suppliers is stock; paying/issuing invoices is finance — even when there is no data for it.`
        : '';
    const access = [
      ...src.map((s) => `Data source "${s.key}" (${s.names.join(', ')}): ${s.status === 'ok' ? 'AVAILABLE — numbers are below' : 'NOT AVAILABLE to your department'}`),
    ].join('\n');
    const block = `${access ? `\n\nDATA ACCESS:\n${access}` : ''}${parts.length ? `\n\nDEPARTMENT DATA (real numbers from the CRM, use them — never invent numbers):\n${parts.join('\n\n')}` : ''}`;
    return { area, block, scope, factsMd, used, missing };
  }
}
