import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientRevenueMonthly } from './client-revenue-monthly.entity';
import { MarketingAccountClient } from './marketing-account-client.entity';
import { MarketingTraffic } from './marketing-traffic.entity';
import { MarketingIntegration } from './marketing-integration.entity';
import { MarketingService } from './marketing.service';

/** Рекламные площадки, чей cost считается расходом на рекламу клиента. */
const SPEND_SQL = `(t."dataSource" LIKE 'google\\_ads%' OR t."dataSource" = 'meta_ads' OR t."dataSource" LIKE 'yandex\\_direct%' OR t."dataSource" LIKE 'vk\\_ads%')`;
/** Кабинеты, которые можно привязать к клиенту (реклама + GA4 сайтов — для выручки на следующих шагах). */
const ACCOUNT_SQL = `(${SPEND_SQL} OR t."dataSource" LIKE 'ga4\\_%' OR t."dataSource" = 'yandex_metrika')`;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
/**
 * Меньше этой ценности за конверсию (в валюте кабинета) — не выручка, а условная ценность:
 * Google Ads по умолчанию ставит конверсии «1» (звонки, клики, формы), и 114 конверсий
 * превращались в «выручку 114 TRY» и ложный ROI −99,9%. Реальное бронирование отеля — тысячи.
 */
const PLACEHOLDER_VALUE_PER_CONVERSION = 10;

export type RoiRevenueSource = 'manual' | 'ads' | 'ga4' | 'crm';

function providerOf(key: string): string {
  if (key.startsWith('google_ads')) return 'google_ads';
  if (key.startsWith('meta_ads')) return 'meta_ads';
  if (key.startsWith('yandex_direct')) return 'yandex_direct';
  if (key.startsWith('vk_ads')) return 'vk_ads';
  if (key.startsWith('ga4')) return 'ga4';
  if (key.startsWith('yandex_metrika')) return 'yandex_metrika';
  return key;
}

function normCurrency(c: unknown): string {
  const s = String(c || 'EUR').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  return /^[A-Z]{3}$/.test(s) ? s : 'EUR';
}

/** Слова названия для подсказки клиента: «Asteria Hotels 2026» → asteria, hotels. */
function nameTokens(s: string): string[] {
  return (s || '')
    .toLocaleLowerCase('tr')
    .replace(/[^a-zа-яёçğıöşü0-9 ]+/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !['hotels', 'hotel', 'resort', 'resorts', 'otel', '2024', '2025', '2026', 'meta', 'google'].includes(w));
}

@Injectable()
export class MarketingRoiService {
  constructor(
    @InjectRepository(MarketingAccountClient)
    private readonly accountRepo: Repository<MarketingAccountClient>,
    @InjectRepository(ClientRevenueMonthly)
    private readonly revenueRepo: Repository<ClientRevenueMonthly>,
    @InjectRepository(MarketingTraffic)
    private readonly trafficRepo: Repository<MarketingTraffic>,
    @InjectRepository(MarketingIntegration)
    private readonly integrationRepo: Repository<MarketingIntegration>,
    private readonly marketing: MarketingService,
  ) {}

  private async listCompanies(tenantId: string): Promise<Array<{ id: string; name: string; city: string | null }>> {
    const rows = (await this.accountRepo.manager.query(
      `SELECT id, name, NULLIF(TRIM(COALESCE(city, '')), '') AS city
         FROM companies WHERE "tenantId" = $1 AND deleted_at IS NULL ORDER BY name ASC`,
      [tenantId],
    )) as Array<{ id: string; name: string; city: string | null }>;
    return rows;
  }

  private async assertCompany(tenantId: string, companyId: string): Promise<void> {
    const rows = (await this.accountRepo.manager.query(
      `SELECT 1 FROM companies WHERE id = $1 AND "tenantId" = $2 AND deleted_at IS NULL`,
      [companyId, tenantId],
    )) as unknown[];
    if (!rows.length) throw new NotFoundException('Компания не найдена');
  }

  /** Все рекламные кабинеты (и GA4) с данными + к какой компании привязаны + подсказка по названию. */
  async listAccounts(tenantId: string) {
    const dsExpr = this.marketing.effectiveDataSourceSql();
    const raw = (await this.trafficRepo
      .createQueryBuilder('t')
      .select(dsExpr, 'key')
      .addSelect('COALESCE(SUM(t.cost), 0)', 'cost')
      .addSelect('MAX(t.currency)', 'currency')
      .addSelect('MAX(t.date)', 'lastDate')
      .where('t.tenantId = :tenantId', { tenantId })
      .andWhere(ACCOUNT_SQL)
      .groupBy(dsExpr)
      .getRawMany()) as Array<{ key: string; cost: string; currency: string; lastDate: string }>;
    const [labels, mappings, companies, integrations] = await Promise.all([
      this.marketing.getMarketingDataSourceLabels(tenantId),
      this.accountRepo.find({ where: { tenantId } }),
      this.listCompanies(tenantId),
      this.integrationRepo.find({ where: { tenantId, provider: 'meta_ads' } }),
    ]);
    const metaByAct = new Map(
      integrations.map((i) => [String(i.primaryId || '').replace(/\D/g, ''), i] as const).filter(([act]) => act),
    );
    const metaActions = (key: string) => {
      const m = /^meta_ads_(\d+)$/.exec(key);
      const integ = m ? metaByAct.get(m[1]) : undefined;
      if (!integ) return null;
      const st = (integ.settings && typeof integ.settings === 'object' ? integ.settings : {}) as Record<string, unknown>;
      const split = (v: unknown) => String(v ?? '').split(',').map((x) => x.trim()).filter(Boolean);
      return {
        available: (st.metaAvailableActions && typeof st.metaAvailableActions === 'object'
          ? st.metaAvailableActions
          : {}) as Record<string, number>,
        conversionAction: split(st.conversionAction).length ? split(st.conversionAction) : ['lead', 'purchase'],
        revenueAction: split(st.revenueAction).length ? split(st.revenueAction) : ['purchase'],
      };
    };
    const byKey = new Map(mappings.map((m) => [m.accountKey, m.companyId]));
    const companyTokens = companies.map((c) => ({ id: c.id, tokens: nameTokens(c.name) }));
    const accounts = raw
      .filter((r) => r.key)
      .map((r) => {
        const label = labels[r.key] || r.key;
        const tokens = nameTokens(label);
        const suggested = byKey.has(r.key)
          ? null
          : companyTokens.find((c) => c.tokens.some((w) => tokens.includes(w)))?.id ?? null;
        return {
          key: r.key,
          label,
          provider: providerOf(r.key),
          cost: Number(r.cost) || 0,
          currency: normCurrency(r.currency),
          lastDate: r.lastDate ? String(r.lastDate).slice(0, 10) : null,
          companyId: byKey.get(r.key) ?? null,
          suggestedCompanyId: suggested,
          metaActions: metaActions(r.key),
        };
      })
      .sort((a, b) => a.provider.localeCompare(b.provider) || b.cost - a.cost);
    return { accounts, companies };
  }

  async setAccountClient(tenantId: string, accountKey: string, companyId: string | null) {
    const key = String(accountKey || '').trim().slice(0, 120);
    if (!key) throw new BadRequestException('accountKey обязателен');
    if (!companyId) {
      await this.accountRepo.delete({ tenantId, accountKey: key });
      return { ok: true, accountKey: key, companyId: null };
    }
    await this.assertCompany(tenantId, companyId);
    await this.accountRepo.upsert({ tenantId, accountKey: key, companyId }, ['tenantId', 'accountKey']);
    return { ok: true, accountKey: key, companyId };
  }

  /**
   * Какие действия Meta считать конверсией / чью ценность — выручкой площадки (по кабинету).
   * Сохраняется в настройках подключения; кабинет сразу пересинхронизируется в фоне.
   */
  async setMetaActions(tenantId: string, accountKey: string, conversionAction: string[], revenueAction: string[]) {
    const m = /^meta_ads_(\d+)$/.exec(String(accountKey || ''));
    if (!m) throw new BadRequestException('Это не кабинет Meta Ads');
    const list = await this.integrationRepo.find({ where: { tenantId, provider: 'meta_ads' } });
    const integ = list.find((i) => String(i.primaryId || '').replace(/\D/g, '') === m[1]);
    if (!integ) throw new NotFoundException('Подключение кабинета Meta не найдено');
    const clean = (a: unknown) =>
      (Array.isArray(a) ? a : [])
        .map((x) => String(x).trim())
        .filter((x) => /^[a-zA-Z0-9_.]{1,120}$/.test(x))
        .slice(0, 20);
    const st = (integ.settings && typeof integ.settings === 'object' ? integ.settings : {}) as Record<string, unknown>;
    integ.settings = {
      ...st,
      conversionAction: clean(conversionAction).join(','),
      revenueAction: clean(revenueAction).join(','),
    } as any;
    await this.integrationRepo.save(integ);
    void this.marketing.syncMetaAdsIntegration(integ).catch(() => undefined);
    return { ok: true, resyncStarted: true };
  }

  async listRevenue(tenantId: string, fromMonth?: string, toMonth?: string) {
    const qb = this.revenueRepo.createQueryBuilder('r').where('r.tenantId = :tenantId', { tenantId });
    if (fromMonth && MONTH_RE.test(fromMonth)) qb.andWhere('r.month >= :fromMonth', { fromMonth });
    if (toMonth && MONTH_RE.test(toMonth)) qb.andWhere('r.month <= :toMonth', { toMonth });
    const rows = await qb.orderBy('r.month', 'ASC').getMany();
    return rows.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      month: r.month,
      amount: Number(r.amount) || 0,
      currency: r.currency,
      source: r.source,
      note: r.note,
    }));
  }

  /** Установить выручку клиента за месяц (пустая сумма — удалить). */
  async upsertRevenue(
    tenantId: string,
    dto: { companyId: string; month: string; amount: number | string | null; currency?: string; note?: string | null },
    source: 'manual' | 'import' = 'manual',
  ) {
    const month = String(dto.month || '').trim();
    if (!MONTH_RE.test(month)) throw new BadRequestException('Месяц в формате ГГГГ-ММ');
    await this.assertCompany(tenantId, dto.companyId);
    const rawAmount = dto.amount;
    if (rawAmount === null || rawAmount === undefined || String(rawAmount).trim() === '') {
      await this.revenueRepo.delete({ tenantId, companyId: dto.companyId, month });
      return { ok: true, deleted: true };
    }
    const amount = typeof rawAmount === 'number' ? rawAmount : Number(String(rawAmount).replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(amount)) throw new BadRequestException('Сумма должна быть числом');
    await this.revenueRepo.upsert(
      {
        tenantId,
        companyId: dto.companyId,
        month,
        amount: String(Math.round(amount * 100) / 100),
        currency: normCurrency(dto.currency),
        source,
        note: dto.note?.trim() ? dto.note.trim().slice(0, 500) : null,
      },
      ['tenantId', 'companyId', 'month'],
    );
    return { ok: true };
  }

  /**
   * Импорт выручки из таблицы отчёта: строки { company (название или id), month, amount, currency }.
   * Компания ищется по id, точному названию, затем по вхождению названия. Нераспознанные строки
   * не угадываются — возвращаются в skipped с причиной.
   */
  async importRevenue(
    tenantId: string,
    rows: Array<{ company?: string; companyId?: string; month?: string; amount?: number | string; currency?: string }>,
  ) {
    if (!Array.isArray(rows) || !rows.length) throw new BadRequestException('Нет строк для импорта');
    if (rows.length > 5000) throw new BadRequestException('Не больше 5000 строк за раз');
    const companies = await this.listCompanies(tenantId);
    const lower = (s: string) => s.trim().toLocaleLowerCase('tr');
    const findCompany = (ref: string) => {
      const r = lower(ref);
      if (!r) return null;
      return (
        companies.find((c) => c.id === ref.trim()) ||
        companies.find((c) => lower(c.name) === r) ||
        (() => {
          const hits = companies.filter((c) => lower(c.name).includes(r) || r.includes(lower(c.name)));
          return hits.length === 1 ? hits[0] : null;
        })()
      );
    };
    let imported = 0;
    const skipped: Array<{ row: number; reason: string }> = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const company = findCompany(String(row.companyId || row.company || ''));
      if (!company) {
        skipped.push({ row: i + 1, reason: `Компания «${row.company || row.companyId || ''}» не найдена` });
        continue;
      }
      let month = String(row.month || '').trim();
      const m = /^(\d{1,2})[./-](\d{4})$/.exec(month);
      if (m) month = `${m[2]}-${m[1].padStart(2, '0')}`;
      if (/^\d{4}-\d{2}-\d{2}/.test(month)) month = month.slice(0, 7);
      if (!MONTH_RE.test(month)) {
        skipped.push({ row: i + 1, reason: `Месяц «${row.month ?? ''}» не распознан (нужно ГГГГ-ММ или ММ.ГГГГ)` });
        continue;
      }
      try {
        await this.upsertRevenue(
          tenantId,
          { companyId: company.id, month, amount: row.amount ?? null, currency: row.currency },
          'import',
        );
        imported++;
      } catch (e: unknown) {
        skipped.push({ row: i + 1, reason: e instanceof Error ? e.message : 'Ошибка' });
      }
    }
    return { imported, skipped };
  }

  /**
   * ROI по клиентам за период месяцев: расход привязанных кабинетов (Google Ads / Meta / Директ / VK)
   * против выручки клиента, всё в одной валюте по курсу ECB (Frankfurter). Непривязанные кабинеты —
   * отдельной строкой, чтобы расход не пропадал молча.
   */
  async getRoi(
    tenantId: string,
    opts: { fromMonth?: string; toMonth?: string; displayCurrency?: string; sources?: RoiRevenueSource[] },
  ) {
    const now = new Date();
    const toMonth = opts.toMonth && MONTH_RE.test(opts.toMonth) ? opts.toMonth : now.toISOString().slice(0, 7);
    const defFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)).toISOString().slice(0, 7);
    const fromMonth = opts.fromMonth && MONTH_RE.test(opts.fromMonth) ? opts.fromMonth : defFrom;
    if (fromMonth > toMonth) throw new BadRequestException('Начало периода позже конца');
    const sources = new Set<RoiRevenueSource>(opts.sources?.length ? opts.sources : ['manual']);

    const fromDate = `${fromMonth}-01`;
    const [ty, tm] = toMonth.split('-').map(Number);
    const toDate = new Date(Date.UTC(ty, tm, 0)).toISOString().slice(0, 10);

    const display = normCurrency(opts.displayCurrency || 'EUR');
    let mult: Record<string, number> = { [display]: 1 };
    let fxAsOf: string | null = null;
    try {
      const fx = await this.marketing.getMarketingFxRates(display);
      mult = fx.multiplyToDisplay;
      fxAsOf = fx.asOf;
    } catch {
      /* без курсов суммы в другой валюте помечаются missingRate */
    }
    const missingRates = new Set<string>();
    const conv = (amount: number, cur: string) => {
      const c = normCurrency(cur);
      if (c === display) return amount;
      const m = mult[c];
      if (m == null || !Number.isFinite(m)) {
        missingRates.add(c);
        return amount;
      }
      return amount * m;
    };

    const dsExpr = this.marketing.effectiveDataSourceSql();
    const spendRaw = (await this.trafficRepo
      .createQueryBuilder('t')
      .select(dsExpr, 'key')
      .addSelect(`to_char(t.date, 'YYYY-MM')`, 'month')
      .addSelect('t.currency', 'currency')
      .addSelect('COALESCE(SUM(t.cost), 0)', 'cost')
      .addSelect('COALESCE(SUM(t.clicks), 0)', 'clicks')
      .addSelect('COALESCE(SUM(t.impressions), 0)', 'impressions')
      .addSelect('COALESCE(SUM(t.conversions), 0)', 'conversions')
      .addSelect('COALESCE(SUM(t."conversionValue"), 0)', 'conversionValue')
      .where('t.tenantId = :tenantId', { tenantId })
      .andWhere('t.date BETWEEN :fromDate AND :toDate', { fromDate, toDate })
      .andWhere(SPEND_SQL)
      .groupBy(dsExpr)
      .addGroupBy(`to_char(t.date, 'YYYY-MM')`)
      .addGroupBy('t.currency')
      .getRawMany()) as Array<{
      key: string;
      month: string;
      currency: string;
      cost: string;
      clicks: string;
      impressions: string;
      conversions: string;
      conversionValue: string;
    }>;

    // Выручка покупок с сайтов (GA4 purchaseRevenue) по ресурсам, привязанным к клиентам.
    const ga4Raw = (await this.trafficRepo
      .createQueryBuilder('t')
      .select('t.dataSource', 'key')
      .addSelect(`to_char(t.date, 'YYYY-MM')`, 'month')
      .addSelect('t.currency', 'currency')
      .addSelect('COALESCE(SUM(t.revenue), 0)', 'revenue')
      .where('t.tenantId = :tenantId', { tenantId })
      .andWhere('t.date BETWEEN :fromDate AND :toDate', { fromDate, toDate })
      .andWhere(`t."dataSource" LIKE 'ga4\\_%'`)
      .groupBy('t.dataSource')
      .addGroupBy(`to_char(t.date, 'YYYY-MM')`)
      .addGroupBy('t.currency')
      .having('COALESCE(SUM(t.revenue), 0) <> 0')
      .getRawMany()) as Array<{ key: string; month: string; currency: string; revenue: string }>;

    const [mappings, companies, labels, revenueRows] = await Promise.all([
      this.accountRepo.find({ where: { tenantId } }),
      this.listCompanies(tenantId),
      this.marketing.getMarketingDataSourceLabels(tenantId),
      this.listRevenue(tenantId, fromMonth, toMonth),
    ]);
    const companyOf = new Map(mappings.map((m) => [m.accountKey, m.companyId]));
    const companyName = new Map(companies.map((c) => [c.id, c.name]));
    const companyCity = new Map(companies.map((c) => [c.id, c.city]));

    type Cell = {
      spend: number;
      clicks: number;
      impressions: number;
      conversions: number;
      revenueManual: number;
      revenueAds: number;
      revenueGa4: number;
      revenueCrm: number;
      /** Условная ценность конверсий (≈1 за конверсию) — в выручку не входит, показывается отдельно. */
      adsPlaceholder: number;
    };
    type AccAgg = { spend: number; clicks: number; conversions: number };
    type Row = {
      companyId: string | null;
      accounts: Map<string, AccAgg>;
      months: Map<string, Cell>;
      /** Кабинеты, у которых ценность конверсий условная (не выручка). */
      placeholderAccounts: Set<string>;
    };
    const rows = new Map<string, Row>();
    const ensure = (id: string | null) => {
      const k = id ?? '__unassigned__';
      let r = rows.get(k);
      if (!r) {
        r = { companyId: id, accounts: new Map(), months: new Map(), placeholderAccounts: new Set() };
        rows.set(k, r);
      }
      return r;
    };
    const cell = (r: Row, month: string) => {
      let c = r.months.get(month);
      if (!c) {
        c = { spend: 0, clicks: 0, impressions: 0, conversions: 0, revenueManual: 0, revenueAds: 0, revenueGa4: 0, revenueCrm: 0, adsPlaceholder: 0 };
        r.months.set(month, c);
      }
      return c;
    };

    for (const s of spendRaw) {
      const companyId = companyOf.get(s.key) ?? null;
      const r = ensure(companyId && companyName.has(companyId) ? companyId : null);
      const spend = conv(Number(s.cost) || 0, s.currency);
      const acc = r.accounts.get(s.key) ?? { spend: 0, clicks: 0, conversions: 0 };
      acc.spend += spend;
      acc.clicks += Number(s.clicks) || 0;
      acc.conversions += Number(s.conversions) || 0;
      r.accounts.set(s.key, acc);
      const c = cell(r, s.month);
      c.spend += spend;
      c.clicks += Number(s.clicks) || 0;
      c.impressions += Number(s.impressions) || 0;
      c.conversions += Number(s.conversions) || 0;
      const cvRaw = Number(s.conversionValue) || 0;
      const convRaw = Number(s.conversions) || 0;
      if (cvRaw > 0 && convRaw > 0 && cvRaw / convRaw < PLACEHOLDER_VALUE_PER_CONVERSION) {
        c.adsPlaceholder += conv(cvRaw, s.currency);
        r.placeholderAccounts.add(s.key);
      } else {
        c.revenueAds += conv(cvRaw, s.currency);
      }
    }
    for (const g of ga4Raw) {
      const companyId = companyOf.get(g.key);
      // Непривязанный сайт в ROI не входит (у него нет расхода «без клиента», только выручка).
      if (!companyId || !companyName.has(companyId)) continue;
      const r = ensure(companyId);
      if (!r.accounts.has(g.key)) r.accounts.set(g.key, { spend: 0, clicks: 0, conversions: 0 });
      cell(r, g.month).revenueGa4 += conv(Number(g.revenue) || 0, g.currency);
    }
    // Продажи CRM (подтверждённые): UTM-кампания лида → кабинет с такой кампанией → клиент;
    // иначе поле «Отель» продажи = название компании. Неоднозначное не угадываем.
    const crmUnattributed = { amount: 0, count: 0 };
    {
      const campRows = (await this.trafficRepo
        .createQueryBuilder('t')
        .select(dsExpr, 'key')
        .addSelect(`LOWER(TRIM(t.campaign))`, 'campaign')
        .where('t.tenantId = :tenantId', { tenantId })
        .andWhere(SPEND_SQL)
        .andWhere(`COALESCE(TRIM(t.campaign), '') <> ''`)
        .groupBy(dsExpr)
        .addGroupBy(`LOWER(TRIM(t.campaign))`)
        .getRawMany()) as Array<{ key: string; campaign: string }>;
      const campaignCompanies = new Map<string, Set<string>>();
      for (const r of campRows) {
        const companyId = companyOf.get(r.key);
        if (!companyId) continue;
        const set = campaignCompanies.get(r.campaign) ?? new Set<string>();
        set.add(companyId);
        campaignCompanies.set(r.campaign, set);
      }
      const byName = (hotel: string) => {
        const h = hotel.trim().toLocaleLowerCase('tr');
        if (!h) return null;
        const exact = companies.filter((c) => c.name.trim().toLocaleLowerCase('tr') === h);
        if (exact.length === 1) return exact[0].id;
        const part = companies.filter((c) => {
          const n = c.name.trim().toLocaleLowerCase('tr');
          return n.length >= 4 && (h.includes(n) || n.includes(h));
        });
        return part.length === 1 ? part[0].id : null;
      };
      const sales = (await this.accountRepo.manager.query(
        `SELECT s.amount, s.currency, to_char(COALESCE(s."saleDate", s."createdAt"), 'YYYY-MM') AS month,
                s.hotel, l."utmCampaign" AS "utmCampaign"
           FROM sales s
           LEFT JOIN leads l ON l.id = s.lead_id AND l.deleted_at IS NULL
          WHERE s."tenantId" = $1 AND s.status = 'confirmed'
            AND COALESCE(s."saleDate", s."createdAt") >= $2::date
            AND COALESCE(s."saleDate", s."createdAt") < ($3::date + interval '1 day')`,
        [tenantId, fromDate, toDate],
      )) as Array<{ amount: string; currency: string; month: string; hotel: string | null; utmCampaign: string | null }>;
      for (const sale of sales) {
        const amount = conv(Number(sale.amount) || 0, sale.currency || display);
        let companyId: string | null = null;
        const camp = (sale.utmCampaign || '').trim().toLocaleLowerCase();
        if (camp) {
          const set = campaignCompanies.get(camp);
          if (set && set.size === 1) companyId = [...set][0];
        }
        if (!companyId && sale.hotel) companyId = byName(sale.hotel);
        if (!companyId || !companyName.has(companyId)) {
          crmUnattributed.amount += amount;
          crmUnattributed.count += 1;
          continue;
        }
        cell(ensure(companyId), sale.month).revenueCrm += amount;
      }
    }

    for (const rev of revenueRows) {
      if (!companyName.has(rev.companyId)) continue;
      cell(ensure(rev.companyId), rev.month).revenueManual += conv(rev.amount, rev.currency);
    }

    const months: string[] = [];
    for (let d = new Date(Date.UTC(Number(fromMonth.slice(0, 4)), Number(fromMonth.slice(5)) - 1, 1)); d.toISOString().slice(0, 7) <= toMonth; d.setUTCMonth(d.getUTCMonth() + 1)) {
      months.push(d.toISOString().slice(0, 7));
    }

    const metrics = (spend: number, revenue: number, clicks: number, impressions: number, conversions: number) => ({
      spend: Math.round(spend * 100) / 100,
      revenue: Math.round(revenue * 100) / 100,
      clicks,
      impressions,
      conversions: Math.round(conversions * 100) / 100,
      /** Стоимость конверсии (по данным площадок). */
      cpa: conversions > 0 && spend > 0 ? Math.round((spend / conversions) * 100) / 100 : null,
      /** ROI % = (выручка − расход) / расход; null, если нет расхода или выручки. */
      roi: spend > 0 && revenue > 0 ? Math.round(((revenue - spend) / spend) * 10000) / 100 : null,
      /** ROAS = выручка / расход. */
      roas: spend > 0 && revenue > 0 ? Math.round((revenue / spend) * 100) / 100 : null,
      cpc: clicks > 0 && spend > 0 ? Math.round((spend / clicks) * 100) / 100 : null,
    });

    const out = [...rows.values()].map((r) => {
      let ts = 0, tr = 0, tc = 0, ti = 0, tv = 0;
      /** Месяцы, где выручка есть и в конверсиях площадок, и в GA4 — часто это одни и те же покупки
       * (Google Ads импортирует покупки GA4 как конверсии), сумма двух источников их удвоит. */
      const overlapMonths: string[] = [];
      const byMonth: Record<string, ReturnType<typeof metrics> & { revenueBySource: Record<string, number> }> = {};
      for (const m of months) {
        const c = r.months.get(m);
        if (!c) continue;
        const revenue =
          (sources.has('manual') ? c.revenueManual : 0) +
          (sources.has('ads') ? c.revenueAds : 0) +
          (sources.has('ga4') ? c.revenueGa4 : 0) +
          (sources.has('crm') ? c.revenueCrm : 0);
        ts += c.spend; tr += revenue; tc += c.clicks; ti += c.impressions; tv += c.conversions;
        if (sources.has('ads') && sources.has('ga4') && c.revenueAds > 0 && c.revenueGa4 > 0) overlapMonths.push(m);
        byMonth[m] = {
          ...metrics(c.spend, revenue, c.clicks, c.impressions, c.conversions),
          revenueBySource: {
            manual: Math.round(c.revenueManual * 100) / 100,
            ads: Math.round(c.revenueAds * 100) / 100,
            ga4: Math.round(c.revenueGa4 * 100) / 100,
            crm: Math.round(c.revenueCrm * 100) / 100,
            adsPlaceholder: Math.round(c.adsPlaceholder * 100) / 100,
          },
        };
      }
      return {
        companyId: r.companyId,
        name: r.companyId ? companyName.get(r.companyId) || '—' : null,
        city: r.companyId ? companyCity.get(r.companyId) ?? null : null,
        accounts: [...r.accounts.entries()]
          .map(([key, a]) => ({
            key,
            label: labels[key] || key,
            provider: providerOf(key),
            spend: Math.round(a.spend * 100) / 100,
            clicks: a.clicks,
            conversions: Math.round(a.conversions * 100) / 100,
          }))
          .sort((a, b) => b.spend - a.spend),
        months: byMonth,
        overlapMonths,
        /** Кабинеты с условной ценностью конверсий — она не считается выручкой. */
        placeholderValueAccounts: [...r.placeholderAccounts].map((k) => labels[k] || k),
        total: metrics(ts, tr, tc, ti, tv),
      };
    });
    const assigned = out.filter((r) => r.companyId).sort((a, b) => b.total.spend - a.total.spend);
    const unassigned = out.find((r) => !r.companyId) ?? null;
    const grand = assigned.reduce(
      (acc, r) => ({
        spend: acc.spend + r.total.spend,
        revenue: acc.revenue + r.total.revenue,
        clicks: acc.clicks + r.total.clicks,
        impressions: acc.impressions + r.total.impressions,
        conversions: acc.conversions + r.total.conversions,
      }),
      { spend: 0, revenue: 0, clicks: 0, impressions: 0, conversions: 0 },
    );
    return {
      fromMonth,
      toMonth,
      months,
      displayCurrency: display,
      fxAsOf,
      missingRates: [...missingRates],
      sources: [...sources],
      clients: assigned,
      unassigned,
      /** Подтверждённые продажи CRM за период, которые не удалось однозначно отнести к клиенту. */
      crmUnattributed: {
        amount: Math.round(crmUnattributed.amount * 100) / 100,
        count: crmUnattributed.count,
      },
      total: metrics(grand.spend, grand.revenue, grand.clicks, grand.impressions, grand.conversions),
    };
  }
}
