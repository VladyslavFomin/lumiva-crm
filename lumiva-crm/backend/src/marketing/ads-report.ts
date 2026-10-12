/**
 * Отчёт по рекламным расходам, который целиком считает и рисует сервер.
 *
 * Зачем (2026-10-08): ИИ (чат, сотрудники, офис) переписывал цифры из данных в ответ сам и
 * ошибался — брал срез одного рынка за итог, терял второй кабинет бренда, неверно складывал «Итого»,
 * мог перепутать месяцы. Теперь модель только выбирает, ЧТО показать (период, площадка, группировка,
 * клиенты), а таблица с числами вставляется в ответ кодом без участия модели.
 */

export type AdsReportGroupBy = 'client' | 'account' | 'platform';
export type AdsReportLang = 'ru' | 'en' | 'tr';

export type AdsMetrics = { cost: number; clicks: number; impressions: number; conversions: number };

export type AdsReportRow = {
  group: string;
  /** Откуда взята привязка кабинетов: client — «ROI по клиентам», name — по названию кабинета. */
  mapping: 'client' | 'name' | 'account' | 'platform' | 'unassigned';
  accounts: string[];
  currency: string;
  months: Record<string, AdsMetrics>;
  total: AdsMetrics;
  /** Те же метрики по каждому кабинету строки (для проверки чисел, названных по кабинету). */
  perAccount: Array<{ account: string; months: Record<string, AdsMetrics>; total: AdsMetrics }>;
};

export type AdsReport = {
  ok: true;
  from: string;
  to: string;
  months: string[];
  platform: string | null;
  groupBy: AdsReportGroupBy;
  rows: AdsReportRow[];
  totals: Array<{ currency: string; months: Record<string, AdsMetrics>; total: AdsMetrics }>;
  /** Кабинеты с расходом, не вошедшие ни в одну строку (при фильтре по клиентам). */
  notIncluded: Array<{ account: string; currency: string; cost: number }>;
  unmatchedClients: string[];
  fx: { display: string; asOf: string; source: string } | null;
  markdown: string;
};

export const PLATFORM_LABEL: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  yandex_direct: 'Яндекс Директ',
  vk_ads: 'VK Реклама',
};

const MONTHS: Record<AdsReportLang, string[]> = {
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
};

const L = {
  ru: { cpa: 'Цена конверсии', client: 'Клиент', account: 'Кабинет', platform: 'Площадка', spend: 'Расход', total: 'Итого', clicks: 'Клики', impr: 'Показы', conv: 'Конверсии', accounts: 'Кабинеты', all: 'все площадки', note: 'данные рекламных кабинетов, посчитано системой', notIncluded: 'Не вошли в отчёт (другие клиенты / без привязки)', unmatched: 'Не найдены клиенты', unassigned: 'Без привязки к клиенту', fx: 'пересчёт по курсу' },
  en: { cpa: 'Cost / conversion', client: 'Client', account: 'Account', platform: 'Platform', spend: 'Spend', total: 'Total', clicks: 'Clicks', impr: 'Impressions', conv: 'Conversions', accounts: 'Accounts', all: 'all platforms', note: 'ad-account data, computed by the system', notIncluded: 'Not included (other clients / unassigned)', unmatched: 'Clients not found', unassigned: 'Not assigned to a client', fx: 'converted at rate' },
  tr: { cpa: 'Dönüşüm başı maliyet', client: 'Müşteri', account: 'Hesap', platform: 'Platform', spend: 'Harcama', total: 'Toplam', clicks: 'Tıklama', impr: 'Gösterim', conv: 'Dönüşüm', accounts: 'Hesaplar', all: 'tüm platformlar', note: 'reklam hesabı verileri, sistem tarafından hesaplandı', notIncluded: 'Rapora dahil edilmeyenler (diğer müşteriler / atanmamış)', unmatched: 'Bulunamayan müşteriler', unassigned: 'Müşteriye atanmamış', fx: 'kurla çevrildi' },
} as const;

/** Производные метрики — считает код: цена конверсии, цена клика, CTR (%). null — делить не на что. */
export function derivedMetrics(m: AdsMetrics): { cpa: number | null; cpc: number | null; ctr: number | null } {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    cpa: m.conversions > 0 ? r2(m.cost / m.conversions) : null,
    cpc: m.clicks > 0 ? r2(m.cost / m.clicks) : null,
    ctr: m.impressions > 0 ? r2((m.clicks / m.impressions) * 100) : null,
  };
}

export const emptyMetrics = (): AdsMetrics => ({ cost: 0, clicks: 0, impressions: 0, conversions: 0 });

export function addMetrics(a: AdsMetrics, b: AdsMetrics): AdsMetrics {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { cost: r2(a.cost + b.cost), clicks: a.clicks + b.clicks, impressions: a.impressions + b.impressions, conversions: r2(a.conversions + b.conversions) };
}

export function monthLabel(mo: string, lang: AdsReportLang): string {
  const [y, m] = mo.split('-');
  return `${MONTHS[lang][Number(m) - 1] ?? m} ${y}`;
}

function loc(lang: AdsReportLang) {
  return lang === 'ru' ? 'ru-RU' : lang === 'tr' ? 'tr-TR' : 'en-US';
}

export function fmtMoney(v: number, currency: string, lang: AdsReportLang): string {
  return `${v.toLocaleString(loc(lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function fmtInt(v: number, lang: AdsReportLang): string {
  return v.toLocaleString(loc(lang), { maximumFractionDigits: 2 });
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

const cell = (s: string) => s.replace(/\|/g, '/').replace(/\n/g, ' ');

/** Markdown-таблица отчёта. Числа — только отсюда, модель их не перепечатывает. */
export function renderAdsReportMarkdown(r: Omit<AdsReport, 'markdown'>, lang: AdsReportLang): string {
  const t = L[lang];
  const firstCol = r.groupBy === 'client' ? t.client : r.groupBy === 'platform' ? t.platform : t.account;
  const multi = r.months.length > 1;
  const header = multi
    ? [firstCol, ...r.months.map((m) => `${monthLabel(m, lang)}`), `${t.total}`, t.clicks, t.conv, t.cpa, ...(r.groupBy === 'client' ? [t.accounts] : [])]
    : [firstCol, t.spend, t.clicks, t.impr, t.conv, t.cpa, ...(r.groupBy === 'client' ? [t.accounts] : [])];
  const lines: string[] = [];
  const platformName = r.platform ? PLATFORM_LABEL[r.platform] ?? r.platform : t.all;
  lines.push(
    `_${platformName} · ${fmtDate(r.from)} — ${fmtDate(r.to)} · ${t.note}${r.fx ? ` · ${t.fx} ${r.fx.display} (${r.fx.source}, ${r.fx.asOf})` : ''}_`,
    '',
    `| ${header.join(' | ')} |`,
    `|${header.map((h, i) => (i === 0 || h === t.accounts ? '---' : '---:')).join('|')}|`,
  );
  const accountsCell = (row: AdsReportRow) => {
    const shown = row.accounts.slice(0, 3).join(', ');
    return cell(row.accounts.length > 3 ? `${shown} +${row.accounts.length - 3}` : shown);
  };
  const cpaCell = (m: AdsMetrics, cur: string) => {
    const d = derivedMetrics(m);
    return d.cpa === null ? '—' : fmtMoney(d.cpa, cur, lang);
  };
  const rowCells = (name: string, cur: string, months: Record<string, AdsMetrics>, total: AdsMetrics, accounts?: string) =>
    multi
      ? [name, ...r.months.map((m) => fmtMoney(months[m]?.cost ?? 0, cur, lang)), fmtMoney(total.cost, cur, lang), fmtInt(total.clicks, lang), fmtInt(total.conversions, lang), cpaCell(total, cur), ...(accounts !== undefined ? [accounts] : [])]
      : [name, fmtMoney(total.cost, cur, lang), fmtInt(total.clicks, lang), fmtInt(total.impressions, lang), fmtInt(total.conversions, lang), cpaCell(total, cur), ...(accounts !== undefined ? [accounts] : [])];
  for (const row of r.rows) {
    lines.push(`| ${rowCells(cell(row.group), row.currency, row.months, row.total, r.groupBy === 'client' ? accountsCell(row) : undefined).join(' | ')} |`);
  }
  if (r.rows.length > 1) {
    for (const tot of r.totals) {
      const c = rowCells(`**${t.total}${r.totals.length > 1 ? ` (${tot.currency})` : ''}**`, tot.currency, tot.months, tot.total, r.groupBy === 'client' ? '' : undefined);
      lines.push(`| ${c.map((x, i) => (i === 0 || !x ? x : `**${x}**`)).join(' | ')} |`);
    }
  }
  if (r.notIncluded.length) {
    lines.push('', `_${t.notIncluded}: ${r.notIncluded.slice(0, 8).map((n) => `${cell(n.account)} — ${fmtMoney(n.cost, n.currency, lang)}`).join('; ')}${r.notIncluded.length > 8 ? ` …+${r.notIncluded.length - 8}` : ''}_`);
  }
  if (r.unmatchedClients.length) lines.push('', `_${t.unmatched}: ${r.unmatchedClients.join(', ')}_`);
  return lines.join('\n');
}

/**
 * Факты отчёта для проверки привязки чисел: «значение X относится к группе G за месяц M».
 * month = null — итог за весь период.
 */
export function adsReportFacts(r: Pick<AdsReport, 'rows' | 'totals' | 'months'>): Array<{ labels: string[]; month: string | null; value: number }> {
  const out: Array<{ labels: string[]; month: string | null; value: number }> = [];
  const push = (labels: string[], month: string | null, m: AdsMetrics) => {
    const d = derivedMetrics(m);
    for (const v of [m.cost, m.clicks, m.impressions, m.conversions, d.cpa, d.cpc, d.ctr]) if (v !== null) out.push({ labels, month, value: v });
  };
  for (const row of r.rows) {
    for (const mo of r.months) push([row.group], mo, row.months[mo] ?? emptyMetrics());
    push([row.group], null, row.total);
    for (const a of row.perAccount ?? []) {
      for (const mo of r.months) push([a.account], mo, a.months[mo] ?? emptyMetrics());
      push([a.account], null, a.total);
    }
  }
  return out;
}
