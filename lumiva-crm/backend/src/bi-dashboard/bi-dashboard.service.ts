// src/bi-dashboard/bi-dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../leads/lead.entity';
import { Sale } from '../sales/sale.entity';
import { Product } from '../products/product.entity';
import { Reservation } from '../bookings/reservation.entity';
import { HotelReservation } from '../hotels/hotel-reservation.entity';
import { Hotel } from '../hotels/hotel.entity';
import { Call } from '../telephony/call.entity';
import { SmsMessage } from '../sms/sms-message.entity';
import { Tenant } from '../tenants/tenant.entity';
import { Contact } from '../contacts/contact.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { isTelephonyIncludedInPlan } from '../tenants/plan-entitlements';
import { CompaniesService } from '../companies/companies.service';
import { MarketingService } from '../marketing/marketing.service';
import { MarketingIntegration } from '../marketing/marketing-integration.entity';
import { MarketingTraffic } from '../marketing/marketing-traffic.entity';
import { resolveRowMarket, marketLabel } from '../marketing/marketing-market-catalog';

interface CurrencyAmount {
  currency: string;
  amount: number;
}

interface Trend {
  pct: number;
  direction: 'up' | 'down' | 'flat';
}

export interface BiDashboardSummary {
  period: { days: number; from: string; to: string };
  totals: {
    touches: number;
    touchesTrend: Trend;
    activeClients: number;
    attentionCount: number;
    avgSentiment: number | null;
  };
  leads: {
    total: number;
    won: number;
    lost: number;
    openPipeline: number;
    conversionRate: number;
    trend: Trend;
  };
  sales: {
    total: number;
    confirmed: number;
    revenue: CurrencyAmount[];
    avgDeal: CurrencyAmount[];
    trend: Trend;
  };
  products: {
    activeCount: number;
    inventoryValue: CurrencyAmount[];
    lowStockCount: number;
  };
  bookings: {
    total: number;
    completed: number;
    cancelled: number;
    revenue: CurrencyAmount[];
    trend: Trend;
  };
  hotels: {
    total: number;
    cancelled: number;
    revenue: CurrencyAmount[];
    trend: Trend;
  };
  telephony: {
    enabled: boolean;
    calls: number;
    sms: number;
    pickupRate: number;
    trend: Trend;
  };
  marketing: {
    connectedChannels: number;
    spend: CurrencyAmount[];
    campaigns: number;
    countries: number;
    topCountries: string[];
    channels: Array<{
      provider: string;
      name: string;
      connected: boolean;
      spend: CurrencyAmount[];
      campaigns: number;
      countries: number;
      topCountries: string[];
      lastDataDate: string | null;
    }>;
  };
  dailyTrend: Array<{
    date: string;
    leads: number;
    sales: number;
    bookings: number;
    hotels: number;
    calls: number;
  }>;
  channels: Array<{ key: string; label: string; count: number }>;
  funnel: Array<{ key: string; label: string; value: number }>;
  topCompanies: Array<{ id: string; name: string; leads: number; projects: number; revenue: number }>;
  team: Array<{ id: string; name: string; leads: number; calls: number; bookings: number; total: number }>;
  alerts: Array<{ module: string; risk: 'ok' | 'warn' | 'bad'; text: string; link: string }>;
}

const BOOKING_CANCELLED_STATUSES = ['cancelled_by_customer', 'cancelled_by_business', 'rejected', 'no_show'];

const SOURCE_LABELS: Record<string, string> = {
  crm: 'Вручную (CRM)',
  web: 'Сайт (формы)',
  embed_form: 'Встроенная форма',
  woocommerce: 'WooCommerce',
  csv_import: 'Импорт CSV',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  chat: 'Чат на сайте',
  api: 'API',
};

const MARKETING_PROVIDER_LABELS: Record<string, string> = {
  yandex_direct: 'Yandex Direct',
  vk_ads: 'VK Реклама',
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  tiktok_ads: 'TikTok Ads',
};

@Injectable()
export class BiDashboardService {
  constructor(
    @InjectRepository(Lead) private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Sale) private readonly saleRepo: Repository<Sale>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Reservation) private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(HotelReservation) private readonly hotelReservationRepo: Repository<HotelReservation>,
    @InjectRepository(Hotel) private readonly hotelRepo: Repository<Hotel>,
    @InjectRepository(Call) private readonly callRepo: Repository<Call>,
    @InjectRepository(SmsMessage) private readonly smsRepo: Repository<SmsMessage>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Contact) private readonly contactRepo: Repository<Contact>,
    @InjectRepository(StaffUser) private readonly staffUserRepo: Repository<StaffUser>,
    @InjectRepository(MarketingTraffic) private readonly marketingTrafficRepo: Repository<MarketingTraffic>,
    private readonly companiesService: CompaniesService,
    private readonly marketingService: MarketingService,
  ) {}

  private addToBucket(map: Map<string, number>, currency: string, amount: number) {
    map.set(currency, (map.get(currency) || 0) + amount);
  }

  private toCurrencyAmounts(map: Map<string, number>): CurrencyAmount[] {
    return Array.from(map.entries())
      .map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount);
  }

  private trend(current: number, previous: number): Trend {
    if (previous === 0) {
      return { pct: current > 0 ? 100 : 0, direction: current > 0 ? 'up' : 'flat' };
    }
    const pct = Math.round(((current - previous) / previous) * 1000) / 10;
    return { pct: Math.abs(pct), direction: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat' };
  }

  async getSummary(tenantId: string, days = 30): Promise<BiDashboardSummary> {
    const to = new Date();
    const since = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    const prevSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);
    const sinceStr = since.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const telephonyEnabled = !!tenant?.telephonyAddonEnabled || isTelephonyIncludedInPlan(tenant?.plan);

    const [
      allLeads,
      salesWindow,
      activeProducts,
      lowStockCount,
      allReservations,
      allHotelReservations,
      hotels,
      allCalls,
      smsWindow,
      activeClients,
      allCompanies,
      staffUsers,
      marketingIntegrations,
      marketingRows,
    ] = await Promise.all([
      this.leadRepo.find({ where: { tenantId } }),
      this.saleRepo
        .createQueryBuilder('sale')
        .where('sale.tenantId = :tenantId', { tenantId })
        .andWhere('COALESCE(sale.saleDate, sale."createdAt") >= :prevSince', { prevSince })
        .getMany(),
      this.productRepo.find({ where: { tenantId, status: 'active' } }),
      this.productRepo
        .createQueryBuilder('p')
        .where('p.tenantId = :tenantId', { tenantId })
        .andWhere('p.lowStockThreshold IS NOT NULL')
        .andWhere('p.quantity <= p.lowStockThreshold')
        .getCount(),
      this.reservationRepo.find({ where: { tenantId } }),
      this.hotelReservationRepo.find({ where: { tenantId } }),
      this.hotelRepo.find({ where: { tenantId } }),
      telephonyEnabled ? this.callRepo.find({ where: { tenantId } }) : Promise.resolve([] as Call[]),
      this.smsRepo
        .createQueryBuilder('m')
        .where('m.tenantId = :tenantId', { tenantId })
        .andWhere('m."createdAt" >= :prevSince', { prevSince })
        .getMany(),
      this.contactRepo.count({ where: { tenantId, status: 'active' } }),
      this.companiesService.getAllCompaniesAnalytics(tenantId).catch(() => null),
      this.staffUserRepo.find({ where: { tenantId } }),
      this.marketingService.listMarketingIntegrations(tenantId).catch(() => [] as MarketingIntegration[]),
      // За всё время, а не за выбранный период дашборда (как страница «Маркетинг → Каналы» по
      // умолчанию) — расход на канал это накопленные отношения с площадкой, а не «активность за
      // последние N дней»: иначе канал с остановившейся синхронизацией (протухший OAuth‑токен
      // и т.п.) молча показывал бы 0 вместо реальной накопленной суммы.
      this.marketingTrafficRepo
        .createQueryBuilder('t')
        .select('t.dataSource', 'dataSource')
        .addSelect('t.currency', 'currency')
        .addSelect('t.campaign', 'campaign')
        .addSelect('t.country', 'country')
        .addSelect('COALESCE(SUM(t.cost), 0)', 'cost')
        .addSelect('MAX(t.date)', 'lastDate')
        .where('t.tenantId = :tenantId', { tenantId })
        .groupBy('t.dataSource')
        .addGroupBy('t.currency')
        .addGroupBy('t.campaign')
        .addGroupBy('t.country')
        .limit(20_000)
        .getRawMany<{ dataSource: string | null; currency: string; campaign: string | null; country: string | null; cost: string; lastDate: string | null }>()
        .catch(() => [] as Array<{ dataSource: string | null; currency: string; campaign: string | null; country: string | null; cost: string; lastDate: string | null }>),
    ]);

    // leads
    const leadsPeriod = allLeads.filter((l) => l.createdAt >= since);
    const leadsPrevPeriod = allLeads.filter((l) => l.createdAt >= prevSince && l.createdAt < since);
    const won = leadsPeriod.filter((l) => l.status === 'won').length;
    const lost = leadsPeriod.filter((l) => l.status === 'lost').length;
    const openPipeline = allLeads.filter((l) => l.status !== 'won' && l.status !== 'lost').length;

    // sales
    const salesPeriod = salesWindow.filter((s) => (s.saleDate || s.createdAt) >= since);
    const salesPrevPeriod = salesWindow.filter((s) => (s.saleDate || s.createdAt) >= prevSince && (s.saleDate || s.createdAt) < since);
    const REVENUE_STATUSES = new Set(['confirmed', 'new']);
    const confirmedSales = salesPeriod.filter((s) => REVENUE_STATUSES.has(s.status));
    const confirmedSalesPrev = salesPrevPeriod.filter((s) => REVENUE_STATUSES.has(s.status));
    const revenueMap = new Map<string, number>();
    const countByCurrency = new Map<string, number>();
    for (const s of confirmedSales) {
      const currency = s.currency || 'EUR';
      this.addToBucket(revenueMap, currency, Number(s.amount) || 0);
      countByCurrency.set(currency, (countByCurrency.get(currency) || 0) + 1);
    }
    const avgDealMap = new Map<string, number>();
    for (const [currency, sum] of revenueMap.entries()) {
      avgDealMap.set(currency, sum / (countByCurrency.get(currency) || 1));
    }

    // products
    const inventoryValueMap = new Map<string, number>();
    for (const p of activeProducts) {
      this.addToBucket(inventoryValueMap, p.currency || 'EUR', (Number(p.price) || 0) * (p.quantity || 0));
    }

    // bookings
    const reservationsPeriod = allReservations.filter((r) => r.createdAt >= since);
    const reservationsPrevPeriod = allReservations.filter((r) => r.createdAt >= prevSince && r.createdAt < since);
    const bookingsCompleted = reservationsPeriod.filter((r) => r.status === 'completed');
    const bookingsCancelled = reservationsPeriod.filter((r) => BOOKING_CANCELLED_STATUSES.includes(r.status));
    const bookingsRevenueMap = new Map<string, number>();
    for (const r of bookingsCompleted) this.addToBucket(bookingsRevenueMap, r.currency || 'EUR', Number(r.price) || 0);

    // hotels
    const hotelReservationsPeriod = allHotelReservations.filter((r) => r.createdAt >= since);
    const hotelReservationsPrevPeriod = allHotelReservations.filter((r) => r.createdAt >= prevSince && r.createdAt < since);
    const hotelCancelled = hotelReservationsPeriod.filter((r) => r.status === 'cancelled');
    const hotelCurrency = hotels[0]?.currency || 'USD';
    const hotelRevenueMap = new Map<string, number>();
    for (const r of hotelReservationsPeriod) {
      if (r.status === 'cancelled') continue;
      this.addToBucket(hotelRevenueMap, hotelCurrency, Number(r.total) || 0);
    }

    // telephony
    const callsPeriod = allCalls.filter((c) => c.createdAt >= since);
    const callsPrevPeriod = allCalls.filter((c) => c.createdAt >= prevSince && c.createdAt < since);
    const smsPeriod = smsWindow.filter((m) => m.createdAt >= since);
    const answeredCalls = callsPeriod.filter((c) => c.status === 'completed').length;
    const pickupRate = callsPeriod.length ? Math.round((answeredCalls / callsPeriod.length) * 1000) / 10 : 0;
    const sentimentScores = callsPeriod
      .map((c): number | null => (c.sentiment === 'positive' ? 1 : c.sentiment === 'negative' ? -1 : c.sentiment === 'neutral' ? 0 : null))
      .filter((v): v is number => v !== null);
    const avgSentiment = sentimentScores.length
      ? Math.round((sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length) * 100) / 100
      : null;
    const negativeSentimentCalls = callsPeriod.filter((c) => c.sentiment === 'negative').length;

    // daily trend
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const dayMap = new Map<string, { leads: number; sales: number; bookings: number; hotels: number; calls: number }>();
    for (let i = 0; i < days; i++) {
      dayMap.set(dayKey(new Date(since.getTime() + i * 86400000)), { leads: 0, sales: 0, bookings: 0, hotels: 0, calls: 0 });
    }
    for (const l of leadsPeriod) {
      const bucket = dayMap.get(dayKey(l.createdAt));
      if (bucket) bucket.leads++;
    }
    for (const s of confirmedSales) {
      const bucket = dayMap.get(dayKey(s.saleDate || s.createdAt));
      if (bucket) bucket.sales++;
    }
    for (const r of reservationsPeriod) {
      const bucket = dayMap.get(dayKey(r.createdAt));
      if (bucket) bucket.bookings++;
    }
    for (const r of hotelReservationsPeriod) {
      const bucket = dayMap.get(dayKey(r.createdAt));
      if (bucket) bucket.hotels++;
    }
    for (const c of callsPeriod) {
      const bucket = dayMap.get(dayKey(c.createdAt));
      if (bucket) bucket.calls++;
    }
    const dailyTrend = Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v }));

    // channels — lead source breakdown + calls/sms as channels
    const channelCounts = new Map<string, number>();
    for (const l of leadsPeriod) {
      const key = l.source && SOURCE_LABELS[l.source] ? l.source : l.source ? 'other_named' : 'unknown';
      channelCounts.set(key, (channelCounts.get(key) || 0) + 1);
    }
    const channels: BiDashboardSummary['channels'] = Array.from(channelCounts.entries())
      .map(([key, count]) => ({ key, label: SOURCE_LABELS[key] || (key === 'unknown' ? 'Источник не указан' : 'Другое'), count }))
      .sort((a, b) => b.count - a.count);
    if (telephonyEnabled && callsPeriod.length) channels.push({ key: 'calls', label: 'Звонки (телефония)', count: callsPeriod.length });
    if (smsPeriod.length) channels.push({ key: 'sms', label: 'SMS', count: smsPeriod.length });
    channels.sort((a, b) => b.count - a.count);

    // funnel — lead status distribution
    const funnel: BiDashboardSummary['funnel'] = [
      { key: 'total', label: 'Все лиды', value: leadsPeriod.length },
      { key: 'active', label: 'Не потеряны', value: leadsPeriod.filter((l) => l.status !== 'lost').length },
      { key: 'in_progress', label: 'В работе', value: leadsPeriod.filter((l) => l.status === 'in_progress' || l.status === 'waiting').length },
      { key: 'waiting', label: 'Ожидание ответа', value: leadsPeriod.filter((l) => l.status === 'waiting').length },
      { key: 'won', label: 'Выиграно', value: won },
    ];

    // top companies (real revenue rollup, all-time — reused from companies module)
    const topCompanies: BiDashboardSummary['topCompanies'] = (allCompanies?.topByRevenue || [])
      .slice(0, 5)
      .map((c) => ({ id: c.companyId, name: c.companyName, leads: c.leads, projects: c.projects, revenue: Math.round(c.revenue) }));

    // team — per-staff activity rollup across leads/calls/bookings
    const staffCounts = new Map<string, { leads: number; calls: number; bookings: number }>();
    const bump = (id: string | null | undefined, key: 'leads' | 'calls' | 'bookings') => {
      if (!id) return;
      const entry = staffCounts.get(id) || { leads: 0, calls: 0, bookings: 0 };
      entry[key]++;
      staffCounts.set(id, entry);
    };
    for (const l of leadsPeriod) bump(l.assignedUserId, 'leads');
    for (const c of callsPeriod) bump(c.staffUserId, 'calls');
    for (const r of reservationsPeriod) bump(r.staffUserId || r.assignedUserId, 'bookings');
    const staffById = new Map(staffUsers.map((s) => [s.id, s]));
    const team: BiDashboardSummary['team'] = Array.from(staffCounts.entries())
      .map(([id, c]) => ({
        id,
        name: staffById.get(id)?.fullName || 'Без имени',
        ...c,
        total: c.leads + c.calls + c.bookings,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // alerts — synthesized from real risk signals across modules
    const alerts: BiDashboardSummary['alerts'] = [];
    if (lowStockCount > 0) {
      alerts.push({
        module: 'ТОВАРЫ',
        risk: lowStockCount >= 5 ? 'bad' : 'warn',
        text: `${lowStockCount} товар(ов) с низким остатком — риск дефицита`,
        link: '/app/products/analytics',
      });
    }
    if (reservationsPeriod.length >= 5) {
      const cancelRate = Math.round((bookingsCancelled.length / reservationsPeriod.length) * 1000) / 10;
      if (cancelRate >= 15) {
        alerts.push({
          module: 'БРОНИРОВАНИЯ',
          risk: cancelRate >= 30 ? 'bad' : 'warn',
          text: `Доля отмен броней ${cancelRate}% за период (${bookingsCancelled.length} из ${reservationsPeriod.length})`,
          link: '/bookings/analytics',
        });
      }
    }
    if (hotelReservationsPeriod.length >= 5) {
      const hotelCancelRate = Math.round((hotelCancelled.length / hotelReservationsPeriod.length) * 1000) / 10;
      if (hotelCancelRate >= 15) {
        alerts.push({
          module: 'ОТЕЛИ',
          risk: hotelCancelRate >= 30 ? 'bad' : 'warn',
          text: `Доля отмен бронирований отелей ${hotelCancelRate}% за период`,
          link: '/hotels/analytics',
        });
      }
    }
    if (telephonyEnabled && negativeSentimentCalls > 0) {
      alerts.push({
        module: 'ТЕЛЕФОНИЯ',
        risk: negativeSentimentCalls >= 5 ? 'bad' : 'warn',
        text: `${negativeSentimentCalls} звонк(ов) с негативной тональностью за период`,
        link: '/app/telephony/analytics',
      });
    }
    if (lost > 0) {
      alerts.push({
        module: 'CRM',
        risk: 'warn',
        text: `${lost} лид(ов) переведены в «Проигран» за период — проверьте причины отказа`,
        link: '/app/leads/analytics',
      });
    }
    if (!alerts.length) {
      alerts.push({ module: 'ОБЩЕЕ', risk: 'ok', text: 'Критичных отклонений за период не найдено', link: '/app/analytics' });
    }
    alerts.sort((a, b) => {
      const order = { bad: 0, warn: 1, ok: 2 };
      return order[a.risk] - order[b.risk];
    });

    // marketing — агрегация по каналу (dataSource), в одном проходе по сырым строкам за всё время
    interface MarketingChannelAgg {
      spend: Map<string, number>;
      campaignKeys: Set<string>;
      countryCodes: Set<string>;
      lastDate: string | null;
    }
    const marketingByChannel = new Map<string, MarketingChannelAgg>();
    const getMarketingAgg = (key: string): MarketingChannelAgg => {
      let agg = marketingByChannel.get(key);
      if (!agg) {
        agg = { spend: new Map(), campaignKeys: new Set(), countryCodes: new Set(), lastDate: null };
        marketingByChannel.set(key, agg);
      }
      return agg;
    };
    const marketingAdsIntegrations = marketingIntegrations.filter((m) => m.kind === 'ads');
    /**
     * marketing_traffic.dataSource бывает с суффиксом рекламного аккаунта
     * (google_ads_7873709670, google_ads_8009704244, …) — по одному per Google Ads customer
     * ID, а не один на провайдера. Без этого сведения каждый под-аккаунт превращался в
     * отдельный "неизвестный" псевдо-канал вместо того, чтобы сложиться в одну карточку
     * "Google Ads" рядом с остальными интеграциями.
     */
    const resolveMarketingChannelKey = (dataSource: string | null): string => {
      const ds = (dataSource || '').trim();
      if (!ds) return 'unknown';
      const exact = marketingAdsIntegrations.find((m) => m.provider === ds);
      if (exact) return ds;
      const byPrefix = marketingAdsIntegrations.find((m) => ds.startsWith(`${m.provider}_`));
      if (byPrefix) return byPrefix.provider;
      return ds;
    };
    for (const row of marketingRows) {
      const agg = getMarketingAgg(resolveMarketingChannelKey(row.dataSource));
      const cost = Number(row.cost) || 0;
      if (cost > 0) this.addToBucket(agg.spend, (row.currency || 'EUR').toUpperCase(), cost);
      agg.campaignKeys.add(`${row.campaign || ''}|${row.country || ''}`);
      const marketCode = resolveRowMarket(row.campaign, row.country);
      if (marketCode) agg.countryCodes.add(marketCode);
      if (row.lastDate && (!agg.lastDate || row.lastDate > agg.lastDate)) agg.lastDate = row.lastDate;
    }

    const marketingChannelKeys = new Set<string>([
      ...marketingAdsIntegrations.map((m) => m.provider),
      ...marketingByChannel.keys(),
    ]);
    const marketingChannels = [...marketingChannelKeys]
      .map((key) => {
        const integration = marketingAdsIntegrations.find((m) => m.provider === key);
        const agg = marketingByChannel.get(key);
        const countryLabels = agg ? [...agg.countryCodes].map((c) => marketLabel(c)) : [];
        return {
          provider: key,
          name: integration?.name || MARKETING_PROVIDER_LABELS[key] || key,
          connected: !!integration?.isActive,
          hasIntegration: !!integration,
          spend: agg ? this.toCurrencyAmounts(agg.spend) : [],
          campaigns: agg ? agg.campaignKeys.size : 0,
          countries: countryLabels.length,
          topCountries: countryLabels.slice(0, 5),
          lastDataDate: agg?.lastDate ?? null,
        };
      })
      // показываем канал, если у него реально есть запись интеграции (даже отключённая —
      // пользователь видит, что подключал), либо есть расход/кампании без интеграции (сырые
      // данные трафика без соответствующей записи в marketing_integrations).
      .filter((c) => c.hasIntegration || c.spend.length > 0 || c.campaigns > 0)
      .map(({ hasIntegration: _hasIntegration, ...c }) => c)
      .sort((a, b) => {
        if (a.connected !== b.connected) return a.connected ? -1 : 1;
        const spendOf = (x: typeof a) => x.spend.reduce((sum, v) => sum + v.amount, 0);
        return spendOf(b) - spendOf(a);
      });

    const marketingConnectedChannels = marketingAdsIntegrations.filter((m) => m.isActive).length;
    const marketingSpendMap = new Map<string, number>();
    const marketingCountryCodesAll = new Set<string>();
    let marketingCampaigns = 0;
    for (const agg of marketingByChannel.values()) {
      for (const [cur, amt] of agg.spend) this.addToBucket(marketingSpendMap, cur, amt);
      for (const c of agg.countryCodes) marketingCountryCodesAll.add(c);
      marketingCampaigns += agg.campaignKeys.size;
    }
    const marketingTopCountries = [...marketingCountryCodesAll].map((c) => marketLabel(c)).slice(0, 5);

    const touches = leadsPeriod.length + reservationsPeriod.length + hotelReservationsPeriod.length + callsPeriod.length + smsPeriod.length;
    const touchesPrev =
      leadsPrevPeriod.length + reservationsPrevPeriod.length + hotelReservationsPrevPeriod.length + callsPrevPeriod.length +
      smsWindow.filter((m) => m.createdAt >= prevSince && m.createdAt < since).length;

    return {
      period: { days, from: since.toISOString(), to: to.toISOString() },
      totals: {
        touches,
        touchesTrend: this.trend(touches, touchesPrev),
        activeClients,
        attentionCount: alerts.filter((a) => a.risk !== 'ok').length,
        avgSentiment,
      },
      leads: {
        total: leadsPeriod.length,
        won,
        lost,
        openPipeline,
        conversionRate: leadsPeriod.length ? Math.round((won / leadsPeriod.length) * 1000) / 10 : 0,
        trend: this.trend(leadsPeriod.length, leadsPrevPeriod.length),
      },
      sales: {
        total: salesPeriod.length,
        confirmed: confirmedSales.length,
        revenue: this.toCurrencyAmounts(revenueMap),
        avgDeal: this.toCurrencyAmounts(avgDealMap),
        trend: this.trend(confirmedSales.length, confirmedSalesPrev.length),
      },
      products: {
        activeCount: activeProducts.length,
        inventoryValue: this.toCurrencyAmounts(inventoryValueMap),
        lowStockCount,
      },
      bookings: {
        total: reservationsPeriod.length,
        completed: bookingsCompleted.length,
        cancelled: bookingsCancelled.length,
        revenue: this.toCurrencyAmounts(bookingsRevenueMap),
        trend: this.trend(reservationsPeriod.length, reservationsPrevPeriod.length),
      },
      hotels: {
        total: hotelReservationsPeriod.length,
        cancelled: hotelCancelled.length,
        revenue: this.toCurrencyAmounts(hotelRevenueMap),
        trend: this.trend(hotelReservationsPeriod.length, hotelReservationsPrevPeriod.length),
      },
      telephony: {
        enabled: telephonyEnabled,
        calls: callsPeriod.length,
        sms: smsPeriod.length,
        pickupRate,
        trend: this.trend(callsPeriod.length, callsPrevPeriod.length),
      },
      marketing: {
        connectedChannels: marketingConnectedChannels,
        spend: this.toCurrencyAmounts(marketingSpendMap),
        campaigns: marketingCampaigns,
        countries: marketingCountryCodesAll.size,
        topCountries: marketingTopCountries,
        channels: marketingChannels,
      },
      dailyTrend,
      channels,
      funnel,
      topCompanies,
      team,
      alerts,
    };
  }
}
