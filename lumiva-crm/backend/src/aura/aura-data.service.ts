import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import { Lead } from '../leads/lead.entity';
import { excludeTrashedLeads } from '../leads/lead-relations.util';
import { LeadAccessService } from '../leads/lead-access.service';
import { Sale } from '../sales/sale.entity';
import { Contact } from '../contacts/contact.entity';
import { Call } from '../telephony/call.entity';
import { Reservation } from '../bookings/reservation.entity';
import { BookingLocation } from '../bookings/booking-location.entity';
import { BookingsAnalyticsService } from '../bookings/bookings-analytics.service';
import { HotelReservation } from '../hotels/hotel-reservation.entity';
import { Hotel } from '../hotels/hotel.entity';
import { Product } from '../products/product.entity';
import { ProductStockMovement } from '../products/product-stock-movement.entity';
import { MarketingTraffic } from '../marketing/marketing-traffic.entity';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { StaffUser, StaffRole } from '../staff/staff-user.entity';
import { CurrencyRatesService } from '../currency/currency-rates.service';
import { RbacService } from '../rbac/rbac.service';
import { DataVisibilityService } from '../data-visibility/data-visibility.service';
import {
  AURA_SOURCES,
  AURA_SOURCE_COMPONENT,
  AURA_SOURCE_PERMISSION,
  AURA_WIDGET_BY_KEY,
  type AuraFilterKey,
  type AuraPeriod,
  type AuraSourceKey,
} from './aura-catalog';
import { datasetComponent, isCustomKey, isDecoKey, type AuraCustomWidget } from './aura-custom';
import { COMPONENT_KEYS, isComponentAllowedByPlan } from '../tenants/plan-entitlements';
import { computeCustom, listWorkspaceTables, tableKind } from './aura-custom-data';
import { AURA_DATASETS } from './aura-custom';

/* ───────────────────────── типы ответа ───────────────────────── */

export type AuraFormat = 'int' | 'money' | 'pct' | 'num';
export type AuraDelta = { kind: 'pct' | 'pp'; value: number } | null;
export type AuraWidgetData =
  | { type: 'kpi'; value: number | null; format: AuraFormat; unit?: 'pcs'; delta: AuraDelta; good: boolean | null; spark: number[] | null }
  | { type: 'line'; format: AuraFormat; current: number[]; previous: number[]; total: number; prevTotal: number }
  | { type: 'donut'; format: AuraFormat; items: Array<{ key?: string; name: string; value: number }> }
  | { type: 'funnel'; steps: Array<{ key: string; value: number }> }
  | { type: 'table'; cols: Array<{ key: string; kind: 'text' | 'person' | 'chip' | 'money' | 'int' | 'num' | 'pct' | 'days' }>; rows: Array<Record<string, string | number | null>> }
  | { type: 'bar'; format: AuraFormat; unit?: 'pcs'; people?: boolean; items: Array<{ name: string; value: number }> }
  | { type: 'col'; labels: number[]; data: number[] }
  | { type: 'col2'; format: AuraFormat; labels: string[]; a: number[]; b: number[] }
  | { type: 'heat'; hours: number[]; values: number[][] }
  | { type: 'list'; items: Array<{ kind: string; n?: number; pct?: number; name?: string }> }
  | { type: 'goal'; target: number | null; done: number; pct: number | null; daysLeft: number }
  | { type: 'hero'; name: string | null; items: Array<{ key: string; value: number | null; format: AuraFormat }> }
  | { type: 'check'; items: Array<{ key: string; done: boolean }> }
  | { type: 'gauge'; value: number | null; rows: Array<{ key: string; value: number; tone: AuraTone }> }
  | { type: 'segbar'; format: AuraFormat; items: Array<{ key: string; value: number; tone?: AuraTone }> }
  | {
      type: 'forecast';
      format: AuraFormat;
      done: number;
      projected: number;
      prev: number;
      prevSameDay: number;
      target: number | null;
      day: number;
      days: number;
      /** Накопительно по дням: текущий месяц (до сегодня) и прошлый (весь). */
      series: number[];
      prevSeries: number[];
    }
  | { type: 'stream'; items: AuraStreamItem[] }
  | { type: 'status'; items: Array<{ key: AuraSourceKey; last: string | null; n24: number }> }
  | { type: 'multi'; format: AuraFormat; series: Array<{ key: string; data: number[] }> }
  | { type: 'split'; format: AuraFormat; a: { key: string; value: number }; b: { key: string; value: number } }
  | { type: 'cal'; format: AuraFormat; start: string; values: number[] };

export type AuraTone = 'good' | 'warn' | 'bad' | 'neutral';
export type AuraStreamItem = {
  kind: 'lead' | 'sale' | 'booking' | 'call';
  at: string;
  title: string | null;
  sub: string | null;
  value: number | null;
  format: AuraFormat | null;
  status: string;
};

export type AuraWidgetResult = AuraWidgetData | { error: 'denied' | 'amounts_hidden' | 'failed' | 'locked' };

export type AuraDataResponse = {
  period: { key: AuraPeriod; from: string; to: string; granularity: 'hour' | 'day' | 'week' | 'month'; labels: string[] };
  currency: string;
  generatedAt: string;
  own: boolean;
  widgets: Record<string, AuraWidgetResult>;
  filterOptions: Partial<Record<AuraFilterKey, Array<{ id: string; name: string }>>>;
  /** Блоки со своим периодом: ось и подписи их графиков. */
  blockPeriods?: Record<string, { key: AuraPeriod; granularity: 'hour' | 'day' | 'week' | 'month'; labels: string[] }>;
};

export type AuraFilters = Partial<Record<AuraFilterKey, string>>;

/** Кто смотрит: права на разделы + «Видимость данных». */
export type AuraScope = {
  tenantId: string;
  role: string;
  staff: StaffUser | null;
  can: Set<AuraSourceKey>;
  /** null — видит все лиды; иначе — только разрешённые системой доступа к лидам. */
  leadFilter: ((l: Lead) => boolean) | null;
  /** «Чужие записи» скрыты — продажи/звонки/брони только свои. */
  ownOnly: boolean;
  /** Суммы чужих записей скрыты — денежные показатели только по своим. */
  maskAmounts: boolean;
  /** «Чужие записи» замаскированы — имена в таблицах скрыты. */
  maskNames: boolean;
  /** Права на модули вне разделов Aura (для виджетов ИИ): contacts, companies, custom_objects. */
  extra: Set<string>;
  /** Компоненты тарифа, выключенные у клиента в pl1 (их блоки не считаются и не показываются). */
  lockedComponents: Set<string>;
  /** Разделы Aura, закрытые выключенным компонентом. */
  lockedSources: Set<AuraSourceKey>;
};

export type AuraViewerInput = { userId: string; role: string; email?: string | null; staffUserId?: string | null };

/* ───────────────────────── период ───────────────────────── */

const H = 3_600_000;
const DAY = 24 * H;
type Bucket = { s: number; e: number };
type PeriodModel = {
  key: AuraPeriod;
  granularity: 'hour' | 'day' | 'week' | 'month';
  start: number;
  end: number;
  prevStart: number;
  prevEnd: number;
  buckets: Bucket[];
  prevBuckets: Bucket[];
  labels: string[];
  off: number;
};

function tzOffsetMs(tz: string, at = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(at);
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
    const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second'));
    return asUtc - Math.floor(at.getTime() / 1000) * 1000;
  } catch {
    return 0;
  }
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoLocal = (t: number, off: number) => new Date(t + off).toISOString().slice(0, 10);

export function buildPeriod(key: AuraPeriod, tz: string, nowMs = Date.now()): PeriodModel {
  const off = tzOffsetMs(tz, new Date(nowMs));
  const midnight = Math.floor((nowMs + off) / DAY) * DAY - off;
  const mk = (granularity: PeriodModel['granularity'], buckets: Bucket[], prevBuckets: Bucket[], labels: string[]): PeriodModel => ({
    key,
    granularity,
    start: buckets[0].s,
    end: nowMs,
    prevStart: prevBuckets[0].s,
    prevEnd: prevBuckets[0].s + (nowMs - buckets[0].s),
    buckets,
    prevBuckets,
    labels,
    off,
  });
  if (key === 'today') {
    const hours = Math.floor((nowMs - midnight) / H) + 1;
    const b = Array.from({ length: hours }, (_, h) => ({ s: midnight + h * H, e: midnight + (h + 1) * H }));
    return mk('hour', b, b.map((x) => ({ s: x.s - DAY, e: x.e - DAY })), b.map((_, h) => pad(h)));
  }
  if (key === 'year') {
    const local = new Date(nowMs + off);
    const y = local.getUTCFullYear();
    const m = local.getUTCMonth();
    const b: Bucket[] = [];
    const pb: Bucket[] = [];
    const labels: string[] = [];
    for (let i = 11; i >= 0; i--) {
      b.push({ s: Date.UTC(y, m - i, 1) - off, e: Date.UTC(y, m - i + 1, 1) - off });
      pb.push({ s: Date.UTC(y - 1, m - i, 1) - off, e: Date.UTC(y - 1, m - i + 1, 1) - off });
      labels.push(new Date(Date.UTC(y, m - i, 1)).toISOString().slice(0, 7));
    }
    const model = mk('month', b, pb, labels);
    model.prevEnd = Date.UTC(y - 1, local.getUTCMonth(), local.getUTCDate(), local.getUTCHours(), local.getUTCMinutes()) - off;
    return model;
  }
  const days = key === '7d' ? 7 : key === '30d' ? 30 : 91;
  const step = key === 'quarter' ? 7 * DAY : DAY;
  const n = key === 'quarter' ? 13 : days;
  const start = midnight + DAY - n * step;
  const b = Array.from({ length: n }, (_, i) => ({ s: start + i * step, e: start + (i + 1) * step }));
  const shift = n * step;
  return mk(
    key === 'quarter' ? 'week' : 'day',
    b,
    b.map((x) => ({ s: x.s - shift, e: x.e - shift })),
    b.map((x) => isoLocal(x.s, off)),
  );
}

function bucketIndex(t: number, buckets: Bucket[]): number {
  if (!buckets.length || t < buckets[0].s) return -1;
  for (let i = 0; i < buckets.length; i++) if (t >= buckets[i].s && t < buckets[i].e) return i;
  return -1;
}

const round = (n: number, d = 0) => {
  const k = 10 ** d;
  return Math.round(n * k) / k;
};

function pctDelta(cur: number, prev: number): AuraDelta {
  if (!prev) return null;
  return { kind: 'pct', value: round(((cur - prev) / prev) * 100, 1) };
}

/** good: рост — хорошо (или плохо, если lowerIsBetter); null — нейтрально. */
function goodOf(delta: AuraDelta, mode: 'up' | 'down' | 'neutral'): boolean | null {
  if (!delta || mode === 'neutral' || delta.value === 0) return null;
  return mode === 'up' ? delta.value > 0 : delta.value < 0;
}

const REVENUE_STATUSES = new Set(['confirmed', 'new']);
const MISSED_CALL_STATUSES = new Set(['no-answer', 'busy', 'failed', 'canceled']);
const BOOKING_CANCELLED = new Set(['cancelled_by_customer', 'cancelled_by_business', 'rejected']);
const SPEND_SQL = `(t."dataSource" LIKE 'google\\_ads%' OR t."dataSource" LIKE 'meta\\_ads%' OR t."dataSource" LIKE 'yandex\\_direct%' OR t."dataSource" LIKE 'vk\\_ads%')`;
const AD_CHANNELS: Array<[string, string]> = [
  ['google_ads', 'Google Ads'],
  ['meta_ads', 'Meta Ads'],
  ['yandex_direct', 'Yandex Direct'],
  ['vk_ads', 'VK Ads'],
];

/* ───────────────────────── сервис ───────────────────────── */

@Injectable()
export class AuraDataService {
  private readonly log = new Logger(AuraDataService.name);

  constructor(
    @InjectRepository(Lead) private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Sale) private readonly saleRepo: Repository<Sale>,
    @InjectRepository(Contact) private readonly contactRepo: Repository<Contact>,
    @InjectRepository(Call) private readonly callRepo: Repository<Call>,
    @InjectRepository(Reservation) private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(BookingLocation) private readonly locationRepo: Repository<BookingLocation>,
    @InjectRepository(HotelReservation) private readonly hotelResRepo: Repository<HotelReservation>,
    @InjectRepository(Hotel) private readonly hotelRepo: Repository<Hotel>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductStockMovement) private readonly movementRepo: Repository<ProductStockMovement>,
    @InjectRepository(MarketingTraffic) private readonly trafficRepo: Repository<MarketingTraffic>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(StaffUser) private readonly staffRepo: Repository<StaffUser>,
    private readonly currencyRates: CurrencyRatesService,
    private readonly rbac: RbacService,
    private readonly dataVisibility: DataVisibilityService,
    private readonly leadAccess: LeadAccessService,
    private readonly bookingsAnalytics: BookingsAnalyticsService,
    private readonly db: DataSource,
  ) {}

  /** Контекст для пользовательских виджетов и списка таблиц рабочей области. */
  customCtx(scope: AuraScope, P: PeriodModel | null, conv: (a: unknown, f?: string | null) => number) {
    const can = new Set<string>([...scope.can, ...scope.extra]);
    let names: Promise<Map<string, string>> | null = null;
    const p = P || buildPeriod('30d', 'UTC');
    return {
      db: this.db,
      tenantId: scope.tenantId,
      role: scope.role,
      staffId: scope.staff?.id ?? null,
      staffName: scope.staff?.fullName ?? null,
      can,
      leadFilter: scope.leadFilter,
      ownOnly: scope.ownOnly,
      maskAmounts: scope.maskAmounts,
      period: { start: p.start, end: p.end, prevStart: p.prevStart, prevEnd: p.prevEnd, buckets: p.buckets, prevBuckets: p.prevBuckets, hourly: p.granularity === 'hour' },
      conv,
      staffNames: () =>
        (names ||= this.staffRepo.find({ where: { tenantId: scope.tenantId } }).then((l) => new Map(l.map((x) => [x.id, x.fullName || x.email])))),
    };
  }

  /** Таблицы рабочей области, доступные зрителю (для промпта ИИ). */
  workspaceTables(scope: AuraScope) {
    return listWorkspaceTables(this.customCtx(scope, null, (a) => Number(a) || 0));
  }

  /** Наборы данных для ручного конструктора показателей — только те, к которым у зрителя есть доступ. */
  async datasetsFor(scope: AuraScope) {
    const can = new Set<string>([...scope.can, ...scope.extra]);
    const builtin = AURA_DATASETS.filter((d) => can.has(d.source) && !scope.lockedComponents.has(datasetComponent(d.key) || '')).map((d) => ({
      key: d.key,
      source: d.source,
      noPeriod: !!d.noPeriod,
      fields: d.fields.map((f) => ({ key: f.key, kind: f.kind, values: f.values || null })),
    }));
    const tables = (await this.workspaceTables(scope).catch(() => [])).map((t) => ({
      key: `table:${t.id}`,
      name: t.name,
      fields: t.fields.map((f) => ({ key: f.key, label: f.label, kind: tableKind(f.type), date: /date|time/i.test(f.type) })),
    }));
    // закрытые модулем наборы — отдельно, чтобы конструктор показал «Разблокировать», а не прятал молча
    const locked = AURA_DATASETS.filter((d) => scope.lockedComponents.has(datasetComponent(d.key) || '')).map((d) => d.key);
    return { builtin, tables: scope.lockedComponents.has('custom_objects') ? [] : tables, locked };
  }

  /** Что закрыто тарифом/pl1 — для каталога блоков, шаблонов и конструктора. */
  access(scope: AuraScope) {
    return {
      lockedSources: [...scope.lockedSources],
      lockedComponents: [...scope.lockedComponents].filter((k) => ['leads', 'sales', 'phone_system', 'bookings', 'products', 'marketing', 'hotels', 'contacts', 'companies', 'custom_objects'].includes(k)),
    };
  }

  /* ---------- права зрителя ---------- */

  async buildScope(tenantId: string, viewer: AuraViewerInput): Promise<AuraScope> {
    let staff: StaffUser | null = null;
    if (viewer.staffUserId) staff = await this.staffRepo.findOne({ where: { id: viewer.staffUserId, tenantId } });
    if (!staff) {
      let email = viewer.email || null;
      if (!email && viewer.userId) {
        const u = await this.userRepo.findOne({ where: { id: viewer.userId, tenantId } });
        email = u?.email || null;
      }
      if (email) staff = await this.staffRepo.findOne({ where: { tenantId, email } });
    }
    const role = viewer.role || 'viewer';
    const can = new Set<AuraSourceKey>();
    await Promise.all(
      AURA_SOURCES.map(async (s) => {
        if (await this.rbac.canUserAccess(tenantId, role, staff?.id ?? null, AURA_SOURCE_PERMISSION[s])) can.add(s);
      }),
    );

    let leadFilter: AuraScope['leadFilter'] = null;
    if (!(await this.leadAccess.hasFullAccess(tenantId, staff, role as StaffRole))) {
      const grants = staff ? await this.leadAccess.getGrantsForStaff(tenantId, staff.id) : [];
      leadFilter = (l) => this.leadAccess.canViewAnalytics(this.leadAccess.getEffectiveTier(l, staff, grants));
    }

    const privileged = await this.dataVisibility.isPrivileged(tenantId, role as StaffRole, staff?.id ?? null);
    let ownOnly = false;
    let maskAmounts = false;
    let maskNames = false;
    if (!privileged) {
      const [foreign, amounts] = await Promise.all([
        this.dataVisibility.getRuleValue(tenantId, role as StaffRole, 'foreign_records'),
        this.dataVisibility.getRuleValue(tenantId, role as StaffRole, 'amounts_visibility'),
      ]);
      ownOnly = foreign === 'hide';
      maskNames = foreign === 'masked';
      maskAmounts = amounts === 'owner_manager' || amounts === 'hidden';
    }
    const extra = new Set<string>();
    await Promise.all(
      (['contacts', 'companies', 'custom_objects'] as const).map(async (k) => {
        if (await this.rbac.canUserAccess(tenantId, role, staff?.id ?? null, k)) extra.add(k);
      }),
    );
    const lockedComponents = await this.lockedComponents(tenantId);
    const lockedSources = new Set<AuraSourceKey>(AURA_SOURCES.filter((s) => lockedComponents.has(AURA_SOURCE_COMPONENT[s])));
    for (const s of lockedSources) can.delete(s);
    for (const k of [...extra]) if (lockedComponents.has(k)) extra.delete(k);
    return { tenantId, role, staff, can, leadFilter, ownOnly, maskAmounts, maskNames, extra, lockedComponents, lockedSources };
  }

  /** Как /tenants/components: явный переключатель из pl1, иначе — что разрешает тариф. */
  async lockedComponents(tenantId: string): Promise<Set<string>> {
    const t = await this.tenantRepo.findOne({ where: { id: tenantId }, select: ['id', 'plan', 'enabledComponents'] as any });
    const out = new Set<string>();
    if (!t) return out;
    const en = (t.enabledComponents || {}) as Record<string, boolean>;
    for (const k of COMPONENT_KEYS) {
      const on = typeof en[k] === 'boolean' ? en[k] : isComponentAllowedByPlan(k, t.plan);
      if (!on) out.add(k);
    }
    return out;
  }

  /* ---------- расчёт ---------- */

  async compute(
    scope: AuraScope,
    input: {
      widgets: string[];
      period: AuraPeriod;
      filters?: AuraFilters;
      breakdown?: AuraFilterKey[];
      goals?: { team_goal?: number | null };
      tz?: string;
      custom?: AuraCustomWidget[];
      /** Свой период отдельных блоков (layout[key].period). */
      periods?: Partial<Record<string, AuraPeriod>>;
      /** Валюта отчёта вместо основной валюты компании (главная: переключатель валюты). */
      currency?: string;
    },
  ): Promise<AuraDataResponse> {
    const own = input.periods || {};
    const widgetsAll = [...new Set(input.widgets)].filter((k) => !isDecoKey(k));
    const main = widgetsAll.filter((k) => !own[k] || own[k] === input.period);
    const res = await this.computeOne(scope, { ...input, widgets: main });
    // блоки со своим периодом считаем отдельным проходом на каждый период
    const groups = new Map<AuraPeriod, string[]>();
    for (const k of widgetsAll) {
      const p = own[k];
      if (p && p !== input.period) groups.set(p, [...(groups.get(p) || []), k]);
    }
    if (groups.size) {
      res.blockPeriods = {};
      for (const [p, keys] of groups) {
        const part = await this.computeOne(scope, { ...input, widgets: keys, period: p, breakdown: [] });
        Object.assign(res.widgets, part.widgets);
        for (const k of keys) res.blockPeriods[k] = { key: p, granularity: part.period.granularity, labels: part.period.labels };
      }
    }
    return res;
  }

  private async computeOne(
    scope: AuraScope,
    input: { widgets: string[]; period: AuraPeriod; filters?: AuraFilters; breakdown?: AuraFilterKey[]; goals?: { team_goal?: number | null }; tz?: string; custom?: AuraCustomWidget[]; currency?: string },
  ): Promise<AuraDataResponse> {
    const tenantId = scope.tenantId;
    const tz = this.safeTz(input.tz);
    const P = buildPeriod(input.period, tz);
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId }, select: ['id', 'primaryCurrency'] });
    const rates = await this.currencyRates.getRates().catch(() => ({}) as Record<string, number>);
    // своя валюта — только если на неё есть курс (EUR — база курсов), иначе суммы молча остались бы как есть
    const wanted = (input.currency || '').toUpperCase();
    const currency = /^[A-Z]{3}$/.test(wanted) && (wanted === 'EUR' || rates[wanted]) ? wanted : (tenant?.primaryCurrency || 'EUR').toUpperCase();
    const conv = (amount: unknown, from?: string | null) =>
      this.currencyRates.convertWithRates(Number(amount) || 0, (from || currency).toUpperCase(), currency, rates);
    const filters = input.filters || {};
    const ctx = new Ctx(this, scope, P, conv, filters, tz);

    const widgets: Record<string, AuraWidgetResult> = {};
    const customById = new Map((input.custom || []).map((c) => [c.id, c]));
    const cctx = customById.size ? this.customCtx(scope, P, conv) : null;
    for (const key of [...new Set(input.widgets)]) {
      if (isCustomKey(key)) {
        const c = customById.get(key);
        const comp = c ? datasetComponent(c.dataset) : null;
        if (comp && scope.lockedComponents.has(comp)) {
          widgets[key] = { error: 'locked' };
          continue;
        }
        try {
          widgets[key] = c && cctx ? await computeCustom(cctx, c) : { error: 'failed' };
        } catch (e) {
          this.log.warn(`aura custom widget ${key} failed for ${tenantId}: ${(e as Error).message}`);
          widgets[key] = { error: 'failed' };
        }
        continue;
      }
      const def = AURA_WIDGET_BY_KEY.get(key);
      if (!def) continue;
      if ((def.source !== 'extra' && scope.lockedSources.has(def.source)) || def.needs.some((s) => scope.lockedSources.has(s))) {
        widgets[key] = { error: 'locked' };
        continue;
      }
      if (def.needs.some((s) => !scope.can.has(s))) {
        widgets[key] = { error: 'denied' };
        continue;
      }
      try {
        widgets[key] = await ctx.widget(key, input.goals?.team_goal ?? null);
      } catch (e) {
        this.log.warn(`aura widget ${key} failed for ${tenantId}: ${(e as Error).message}`);
        widgets[key] = { error: 'failed' };
      }
    }

    const filterOptions: AuraDataResponse['filterOptions'] = {};
    for (const f of input.breakdown || []) {
      try {
        filterOptions[f] = await ctx.filterOptions(f);
      } catch {
        filterOptions[f] = [];
      }
    }

    return {
      period: {
        key: P.key,
        from: new Date(P.start).toISOString(),
        to: new Date(P.end).toISOString(),
        granularity: P.granularity,
        labels: P.labels,
      },
      currency,
      generatedAt: new Date().toISOString(),
      own: scope.ownOnly || !!scope.leadFilter,
      widgets,
      filterOptions,
    };
  }

  private safeTz(tz?: string): string {
    if (!tz) return 'UTC';
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    } catch {
      return 'UTC';
    }
  }

  /* ---------- загрузчики (вызываются из Ctx) ---------- */

  loadLeads(tenantId: string, from: number) {
    return this.leadRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere('l.createdAt >= :from', { from: new Date(from) })
      .getMany();
  }

  loadLeadsByIds(tenantId: string, ids: string[]) {
    if (!ids.length) return Promise.resolve([] as Lead[]);
    return this.leadRepo.find({ where: { tenantId, id: In(ids) }, withDeleted: true });
  }

  countStaleLeads(tenantId: string, before: Date) {
    return this.leadRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere(`l.status IN ('in_progress','waiting')`)
      .andWhere('l.updatedAt < :before', { before })
      .getMany();
  }

  loadSales(tenantId: string, from: number) {
    return this.saleRepo
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId', { tenantId })
      .andWhere('COALESCE(s.saleDate, s."createdAt") >= :from', { from: new Date(from) })
      .getMany();
  }

  loadContactOwners(tenantId: string, ids: string[]) {
    if (!ids.length) return Promise.resolve([] as Contact[]);
    return this.contactRepo.find({ where: { tenantId, id: In(ids) }, select: ['id', 'assignedUserId', 'fullName', 'firstName', 'lastName'] as any });
  }

  loadCalls(tenantId: string, from: number) {
    return this.callRepo
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('COALESCE(c.startedAt, c.createdAt) >= :from', { from: new Date(from) })
      .getMany();
  }

  loadReservations(tenantId: string, from: number) {
    const d = new Date(from);
    return this.reservationRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere(new Brackets((qb) => qb.where('r.createdAt >= :d', { d }).orWhere('r.startAt >= :d', { d })))
      .getMany();
  }

  loadLocations(tenantId: string) {
    return this.locationRepo.find({ where: { tenantId } });
  }

  occupancy(tenantId: string, from: number, to: number) {
    return this.bookingsAnalytics.getSummary(tenantId, new Date(from).toISOString(), new Date(to).toISOString());
  }

  async loadHotelRevenue(tenantId: string, from: number) {
    const [rows, hotels] = await Promise.all([
      this.hotelResRepo
        .createQueryBuilder('h')
        .where('h.tenantId = :tenantId', { tenantId })
        .andWhere('h.createdAt >= :from', { from: new Date(from) })
        .getMany(),
      this.hotelRepo.find({ where: { tenantId } }),
    ]);
    const cur = new Map(hotels.map((h) => [h.id, (h.currency || 'USD').toUpperCase()]));
    return rows
      .filter((r) => r.status !== 'cancelled')
      .map((r) => ({ t: r.createdAt.getTime(), amount: Number(r.total) || 0, currency: cur.get(r.hotelId) || 'USD' }));
  }

  loadProducts(tenantId: string) {
    return this.productRepo.find({ where: { tenantId, status: 'active' as any } });
  }

  loadMovements(tenantId: string, from: number) {
    return this.movementRepo
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId })
      .andWhere('m.createdAt >= :from', { from: new Date(from) })
      .getMany();
  }

  async loadSpend(tenantId: string, fromIsoDate: string) {
    const rows = (await this.trafficRepo
      .createQueryBuilder('t')
      .select(`to_char(t.date, 'YYYY-MM-DD')`, 'date')
      .addSelect('t."dataSource"', 'dataSource')
      .addSelect('t.currency', 'currency')
      .addSelect('COALESCE(SUM(t.cost), 0)', 'cost')
      .where('t.tenantId = :tenantId', { tenantId })
      .andWhere('t.date >= :from', { from: fromIsoDate })
      .andWhere(SPEND_SQL)
      .groupBy('t.date')
      .addGroupBy('t."dataSource"')
      .addGroupBy('t.currency')
      .getRawMany()) as Array<{ date: string; dataSource: string; currency: string; cost: string }>;
    return rows;
  }

  loadStaff(tenantId: string) {
    return this.staffRepo.find({ where: { tenantId } });
  }

  loadOpenLeads(tenantId: string) {
    return this.leadRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere(`l.status IN ('new','in_progress','waiting')`)
      .getMany();
  }

  /** Дата первой продажи каждого клиента (contactId или имя гостя) — для «новые vs повторные». */
  async loadFirstSales(tenantId: string): Promise<Map<string, number>> {
    const rows = (await this.saleRepo
      .createQueryBuilder('s')
      .select('s.contactId', 'contactId')
      .addSelect('LOWER(TRIM(s.guestName))', 'guest')
      .addSelect('MIN(COALESCE(s.saleDate, s.createdAt))', 'first')
      .where('s.tenantId = :tenantId', { tenantId })
      .andWhere(`s.status IN ('confirmed','new')`)
      .groupBy('s.contactId')
      .addGroupBy('LOWER(TRIM(s.guestName))')
      .getRawMany()) as Array<{ contactId: string | null; guest: string | null; first: Date | string }>;
    const m = new Map<string, number>();
    for (const r of rows) {
      const key = r.contactId ? `c:${r.contactId}` : r.guest ? `g:${r.guest}` : null;
      if (!key) continue;
      const t = new Date(r.first).getTime();
      if (!m.has(key) || t < m.get(key)!) m.set(key, t);
    }
    return m;
  }

  /** Что уже настроено в CRM — для чек-листа «С чего начать». */
  async setupState(tenantId: string) {
    const one = (repo: Repository<any>, extra?: (qb: any) => any) => {
      let qb = repo.createQueryBuilder('x').select('x.id').where('x.tenantId = :tenantId', { tenantId });
      if (extra) qb = extra(qb);
      return qb
        .limit(1)
        .getRawOne()
        .then((r: unknown) => !!r)
        .catch(() => false);
    };
    const [lead, sale, call, booking, product, ads, staff, apps] = await Promise.all([
      one(this.leadRepo),
      one(this.saleRepo),
      one(this.callRepo),
      one(this.reservationRepo),
      one(this.productRepo),
      this.trafficRepo
        .createQueryBuilder('t')
        .select('1')
        .where('t.tenantId = :tenantId', { tenantId })
        .andWhere(SPEND_SQL)
        .limit(1)
        .getRawOne()
        .then((r) => !!r)
        .catch(() => false),
      this.staffRepo.count({ where: { tenantId } }).catch(() => 0),
      this.db
        .query(`SELECT COUNT(*)::int AS n FROM "aura_apps" WHERE "tenant_id" = $1`, [tenantId])
        .then((r: Array<{ n: number }>) => Number(r?.[0]?.n) || 0)
        .catch(() => 0),
    ]);
    return { lead, sale, call, booking, product, ads, team: staff > 1, aura: apps > 0 };
  }

  /** Когда раздел последний раз получал данные + сколько за сутки. */
  async lastActivity(tenantId: string, source: AuraSourceKey): Promise<{ last: string | null; n24: number }> {
    const q: Partial<Record<AuraSourceKey, [string, string, string]>> = {
      leads: ['leads', '"createdAt"', ''],
      deals: ['sales', 'COALESCE("saleDate","createdAt")', ''],
      team: ['sales', 'COALESCE("saleDate","createdAt")', ''],
      calls: ['calls', 'COALESCE("startedAt","createdAt")', ''],
      booking: ['reservations', '"createdAt"', ''],
      stock: ['product_stock_movements', '"createdAt"', ''],
      marketing: ['marketing_traffic', '"date"::timestamptz', ''],
    };
    const def = q[source];
    if (!def) return { last: null, n24: 0 };
    const [table, col] = def;
    try {
      const r = await this.db.query(
        `SELECT MAX(${col}) AS last, COUNT(*) FILTER (WHERE ${col} >= now() - interval '24 hours')::int AS n24 FROM "${table}" WHERE "tenantId" = $1`,
        [tenantId],
      );
      const last = r?.[0]?.last ? new Date(r[0].last).toISOString() : null;
      return { last, n24: Number(r?.[0]?.n24) || 0 };
    } catch {
      return { last: null, n24: 0 };
    }
  }
}

/* ───────────────────────── контекст одного расчёта ───────────────────────── */

type SaleRow = {
  t: number;
  amount: number;
  status: string;
  name: string | null;
  managerKey: string | null;
  managerName: string | null;
  own: boolean;
  source: string | null;
  /** Ключ клиента для «новые vs повторные»: c:<contactId> или g:<имя гостя>. */
  client: string | null;
};

class Ctx {
  private cache = new Map<string, Promise<unknown>>();
  private readonly loadFrom: number;
  private readonly monthStart: number;

  constructor(
    private readonly svc: AuraDataService,
    private readonly scope: AuraScope,
    private readonly P: PeriodModel,
    private readonly conv: (amount: unknown, from?: string | null) => number,
    private readonly filters: AuraFilters,
    private readonly tz: string,
  ) {
    const local = new Date(Date.now() + P.off);
    this.monthStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - P.off;
    this.loadFrom = Math.min(P.prevStart, this.monthStart);
  }

  private once<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (!this.cache.has(key)) this.cache.set(key, fn());
    return this.cache.get(key) as Promise<T>;
  }

  private get tenantId() {
    return this.scope.tenantId;
  }

  /** Рекламные расходы приходят по дням — в почасовом периоде («Сегодня») их не сравниваем. */
  private get hourly() {
    return this.P.granularity === 'hour';
  }

  private local(t: number) {
    const d = new Date(t + this.P.off);
    return { h: d.getUTCHours(), dow: (d.getUTCDay() + 6) % 7 };
  }

  private inCur = (t: number) => t >= this.P.start && t <= this.P.end;
  private inPrev = (t: number) => t >= this.P.prevStart && t <= this.P.prevEnd;

  private series<T>(items: T[], time: (x: T) => number, val: (x: T) => number = () => 1, prev = false): number[] {
    const buckets = prev ? this.P.prevBuckets : this.P.buckets;
    const out = new Array(buckets.length).fill(0);
    const limit = prev ? this.P.prevEnd : this.P.end;
    for (const it of items) {
      const t = time(it);
      if (t > limit) continue;
      const i = bucketIndex(t, buckets);
      if (i >= 0) out[i] += val(it);
    }
    return out.map((v) => round(v, 2));
  }

  /* ---------- данные ---------- */

  private staffAll() {
    return this.once('staff', () => this.svc.loadStaff(this.tenantId));
  }

  private async staffName(id: string | null | undefined) {
    if (!id) return null;
    const list = await this.staffAll();
    return list.find((s) => s.id === id)?.fullName || null;
  }

  /** Лиды за окно расчёта: без корзины, с правами доступа к лидам и фильтрами шапки. */
  private leads() {
    return this.leadsSince(this.loadFrom);
  }

  private leadsSince(from: number) {
    return this.once(`leads:${from}`, async () => {
      let rows = excludeTrashedLeads(await this.svc.loadLeads(this.tenantId, from));
      if (this.scope.leadFilter) rows = rows.filter(this.scope.leadFilter);
      const f = this.filters;
      if (f.manager) rows = rows.filter((l) => l.assignedUserId === f.manager || (l.assignedUserIds || []).includes(f.manager!));
      if (f.channel) rows = rows.filter((l) => (l.source || 'unknown') === f.channel);
      return rows;
    });
  }

  private sales() {
    return this.salesSince(this.loadFrom);
  }

  private salesSince(from: number) {
    return this.once(`sales:${from}`, async (): Promise<SaleRow[]> => {
      const raw = await this.svc.loadSales(this.tenantId, from);
      const leadIds = [...new Set(raw.map((s) => s.leadId).filter(Boolean) as string[])];
      const contactIds = [...new Set(raw.map((s) => s.contactId).filter(Boolean) as string[])];
      const [leads, contacts, staff] = await Promise.all([
        this.svc.loadLeadsByIds(this.tenantId, leadIds),
        this.svc.loadContactOwners(this.tenantId, contactIds),
        this.staffAll(),
      ]);
      const leadById = new Map(leads.map((l) => [l.id, l]));
      const contactById = new Map(contacts.map((c) => [c.id, c]));
      const staffById = new Map(staff.map((s) => [s.id, s]));
      const me = this.scope.staff;
      const rows: SaleRow[] = raw.map((s) => {
        const lead = s.leadId ? leadById.get(s.leadId) : undefined;
        const contact = s.contactId ? contactById.get(s.contactId) : undefined;
        const assigned = lead?.assignedUserId || contact?.assignedUserId || null;
        const managerName = (assigned && staffById.get(assigned)?.fullName) || s.managerName?.trim() || null;
        const own = !!me && (assigned === me.id || (!!s.managerName && s.managerName.trim() === me.fullName?.trim()));
        const contactName = contact ? contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' ') : '';
        return {
          t: (s.saleDate || s.createdAt).getTime(),
          amount: this.conv(s.amount, s.currency),
          status: s.status,
          name: s.guestName || lead?.name || contactName || (s.externalOrderNo ? `#${s.externalOrderNo}` : null),
          managerKey: assigned || (s.managerName ? `name:${s.managerName.trim()}` : null),
          managerName,
          own,
          source: lead?.source || null,
          client: s.contactId ? `c:${s.contactId}` : s.guestName?.trim() ? `g:${s.guestName.trim().toLowerCase()}` : null,
        };
      });
      const f = this.filters;
      return rows.filter((r) => {
        if (this.scope.ownOnly && !r.own) return false;
        if (f.manager) {
          const name = staffById.get(f.manager)?.fullName;
          if (r.managerKey !== f.manager && !(name && r.managerName === name)) return false;
        }
        if (f.channel && (r.source || 'unknown') !== f.channel) return false;
        return true;
      });
    });
  }

  /** Продажи, учитываемые в деньгах: подтверждённые/новые; при скрытых суммах — только свои. */
  private async revenueSales(from = this.loadFrom) {
    const rows = await this.salesSince(from);
    return rows.filter((r) => REVENUE_STATUSES.has(r.status) && (!this.scope.maskAmounts || r.own));
  }

  private calls() {
    return this.once('calls', async () => {
      let rows = await this.svc.loadCalls(this.tenantId, this.loadFrom);
      const me = this.scope.staff?.id;
      if (this.scope.ownOnly) rows = rows.filter((c) => !!me && c.staffUserId === me);
      if (this.filters.manager) rows = rows.filter((c) => c.staffUserId === this.filters.manager);
      return rows.map((c) => ({
        t: (c.startedAt || c.createdAt).getTime(),
        status: c.status,
        direction: c.direction,
        duration: c.durationSeconds ?? null,
        number: (c.direction === 'inbound' ? c.fromNumber : c.toNumber) || null,
        leadId: c.linkedLeadId || null,
        own: !!me && c.staffUserId === me,
      }));
    });
  }

  private reservations() {
    return this.once('res', async () => {
      let rows = await this.svc.loadReservations(this.tenantId, this.loadFrom);
      const me = this.scope.staff?.id;
      if (this.scope.ownOnly) rows = rows.filter((r) => !!me && (r.staffUserId === me || r.assignedUserId === me));
      if (this.filters.manager) rows = rows.filter((r) => r.staffUserId === this.filters.manager || r.assignedUserId === this.filters.manager);
      if (this.filters.branch) rows = rows.filter((r) => r.locationId === this.filters.branch);
      return rows;
    });
  }

  private products() {
    return this.once('products', async () => {
      const rows = await this.svc.loadProducts(this.tenantId);
      return this.filters.product ? rows.filter((p) => p.id === this.filters.product) : rows;
    });
  }

  private movements() {
    return this.once('mov', async () => {
      const from = Math.min(this.loadFrom, Date.now() - 30 * DAY);
      const rows = await this.svc.loadMovements(this.tenantId, from);
      return this.filters.product ? rows.filter((m) => m.productId === this.filters.product) : rows;
    });
  }

  private finFrom() {
    const local = new Date(Date.now() + this.P.off);
    return Math.min(this.loadFrom, Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 11, 1) - this.P.off);
  }

  /** Все доходы (продажи + брони + отели) в основной валюте, с разбивкой по модулю. */
  private income() {
    return this.once('income', async () => {
      const from = this.finFrom();
      // выключенные в pl1 модули в доходы не попадают
      const L = this.scope.lockedComponents;
      const [sales, res, hotels] = await Promise.all([
        this.svc.loadSales(this.tenantId, from),
        L.has('bookings') ? Promise.resolve([] as Reservation[]) : this.svc.loadReservations(this.tenantId, from),
        L.has('hotels') ? Promise.resolve([] as Array<{ t: number; amount: number; currency: string }>) : this.svc.loadHotelRevenue(this.tenantId, from),
      ]);
      const out: Array<{ t: number; amount: number; kind: 'sales' | 'bookings' | 'hotels' }> = [];
      for (const s of sales) {
        if (!REVENUE_STATUSES.has(s.status)) continue;
        out.push({ t: (s.saleDate || s.createdAt).getTime(), amount: this.conv(s.amount, s.currency), kind: 'sales' });
      }
      for (const r of res) {
        if (r.status !== 'completed' || !r.price) continue;
        out.push({ t: r.createdAt.getTime(), amount: this.conv(r.price, r.currency), kind: 'bookings' });
      }
      for (const h of hotels) out.push({ t: h.t, amount: this.conv(h.amount, h.currency), kind: 'hotels' });
      return out;
    });
  }

  /** Расход на рекламу по дням (дата кабинета = локальная полночь). */
  private spend() {
    return this.once('spend', async () => {
      const from = this.finFrom();
      const rows = await this.svc.loadSpend(this.tenantId, new Date(from + this.P.off).toISOString().slice(0, 10));
      return rows.map((r) => {
        const [y, m, d] = r.date.split('-').map(Number);
        const ds = r.dataSource || '';
        const channel = AD_CHANNELS.find(([k]) => ds === k || ds.startsWith(`${k}_`))?.[1] || ds;
        return { t: Date.UTC(y, m - 1, d) - this.P.off, amount: this.conv(r.cost, r.currency), channel };
      });
    });
  }

  /* ---------- виджеты ---------- */

  async widget(key: string, teamGoal: number | null): Promise<AuraWidgetResult> {
    const moneyBlocked = () => this.scope.maskAmounts;
    switch (key) {
      case 'leads_kpi':
      case 'leads_won': {
        const leads = (await this.leads()).filter((l) => key === 'leads_kpi' || l.status === 'won');
        const t = (l: Lead) => l.createdAt.getTime();
        const cur = leads.filter((l) => this.inCur(t(l))).length;
        const prev = leads.filter((l) => this.inPrev(t(l))).length;
        const delta = pctDelta(cur, prev);
        return { type: 'kpi', value: cur, format: 'int', delta, good: goodOf(delta, 'up'), spark: this.series(leads, t) };
      }
      case 'leads_line': {
        const leads = await this.leads();
        const t = (l: Lead) => l.createdAt.getTime();
        return {
          type: 'line',
          format: 'int',
          current: this.series(leads, t),
          previous: this.series(leads, t, () => 1, true),
          total: leads.filter((l) => this.inCur(t(l))).length,
          prevTotal: leads.filter((l) => this.inPrev(t(l))).length,
        };
      }
      case 'leads_src': {
        const leads = (await this.leads()).filter((l) => this.inCur(l.createdAt.getTime()));
        const m = new Map<string, number>();
        for (const l of leads) m.set(l.source || 'unknown', (m.get(l.source || 'unknown') || 0) + 1);
        const sorted = [...m.entries()].sort((a, b) => b[1] - a[1]);
        const items = sorted.slice(0, 4).map(([k, v]) => ({ key: k, name: k, value: v }));
        const rest = sorted.slice(4).reduce((a, [, v]) => a + v, 0);
        if (rest) items.push({ key: 'other', name: 'other', value: rest });
        return { type: 'donut', format: 'int', items };
      }
      case 'deals_rev':
      case 'deals_avg': {
        const rows = await this.revenueSales();
        const cur = rows.filter((r) => this.inCur(r.t));
        const prev = rows.filter((r) => this.inPrev(r.t));
        const sum = (a: SaleRow[]) => a.reduce((s, r) => s + r.amount, 0);
        if (key === 'deals_rev') {
          const delta = pctDelta(sum(cur), sum(prev));
          return { type: 'kpi', value: round(sum(cur)), format: 'money', delta, good: goodOf(delta, 'up'), spark: this.series(rows, (r) => r.t, (r) => r.amount) };
        }
        const avg = (a: SaleRow[]) => (a.length ? sum(a) / a.length : 0);
        // без продаж в одном из периодов среднего чека нет — и сравнивать нечего
        const delta = cur.length && prev.length ? pctDelta(avg(cur), avg(prev)) : null;
        return { type: 'kpi', value: cur.length ? round(avg(cur)) : null, format: 'money', delta, good: goodOf(delta, 'up'), spark: null };
      }
      case 'deals_conv': {
        const leads = await this.leads();
        const rate = (a: Lead[]) => (a.length ? (a.filter((l) => l.status === 'won').length / a.length) * 100 : 0);
        const cur = leads.filter((l) => this.inCur(l.createdAt.getTime()));
        const prev = leads.filter((l) => this.inPrev(l.createdAt.getTime()));
        const spark = this.P.buckets.map((b) => {
          const inB = leads.filter((l) => l.createdAt.getTime() >= b.s && l.createdAt.getTime() < b.e);
          return round(rate(inB), 1);
        });
        const delta: AuraDelta = prev.length ? { kind: 'pp', value: round(rate(cur) - rate(prev), 1) } : null;
        return { type: 'kpi', value: cur.length ? round(rate(cur), 1) : null, format: 'pct', delta, good: goodOf(delta, 'up'), spark };
      }
      case 'deals_funnel': {
        const leads = (await this.leads()).filter((l) => this.inCur(l.createdAt.getTime()));
        return {
          type: 'funnel',
          steps: [
            { key: 'all', value: leads.length },
            { key: 'contacted', value: leads.filter((l) => l.status !== 'new').length },
            { key: 'active', value: leads.filter((l) => ['in_progress', 'waiting', 'won'].includes(l.status)).length },
            { key: 'won', value: leads.filter((l) => l.status === 'won').length },
          ],
        };
      }
      case 'deals_table': {
        const rows = (await this.revenueSales()).filter((r) => this.inCur(r.t)).sort((a, b) => b.amount - a.amount).slice(0, 6);
        return {
          type: 'table',
          cols: [
            { key: 'deal', kind: 'text' },
            { key: 'manager', kind: 'person' },
            { key: 'status', kind: 'chip' },
            { key: 'amount', kind: 'money' },
          ],
          rows: rows.map((r) => ({
            deal: this.scope.maskNames && !r.own ? '•••' : r.name,
            manager: r.managerName,
            status: r.status,
            amount: round(r.amount),
          })),
        };
      }
      case 'team_goal': {
        const rows = await this.revenueSales();
        const done = round(rows.filter((r) => r.t >= this.monthStart && r.t <= Date.now()).reduce((s, r) => s + r.amount, 0));
        const local = new Date(Date.now() + this.P.off);
        const monthEnd = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1);
        const daysLeft = Math.max(0, Math.ceil((monthEnd - (Date.now() + this.P.off)) / DAY));
        return { type: 'goal', target: teamGoal, done, pct: teamGoal ? round((done / teamGoal) * 100) : null, daysLeft };
      }
      case 'team_bar': {
        const rows = (await this.revenueSales()).filter((r) => this.inCur(r.t));
        const m = new Map<string, number>();
        for (const r of rows) {
          const name = r.managerName || '—';
          m.set(name, (m.get(name) || 0) + r.amount);
        }
        const items = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value: round(value) }));
        return { type: 'bar', format: 'money', people: true, items };
      }
      case 'team_table': {
        const [sales, leads, staff] = await Promise.all([this.revenueSales(), this.leads(), this.staffAll()]);
        const agg = new Map<string, { name: string; deals: number; revenue: number; leads: number; won: number }>();
        const get = (key: string, name: string) => {
          let a = agg.get(key);
          if (!a) agg.set(key, (a = { name, deals: 0, revenue: 0, leads: 0, won: 0 }));
          return a;
        };
        for (const r of sales.filter((x) => this.inCur(x.t))) {
          if (!r.managerName) continue;
          const a = get(r.managerKey || r.managerName, r.managerName);
          a.deals++;
          a.revenue += r.amount;
        }
        const staffById = new Map(staff.map((s) => [s.id, s.fullName]));
        for (const l of leads.filter((x) => this.inCur(x.createdAt.getTime()))) {
          const name = l.assignedUserId ? staffById.get(l.assignedUserId) : null;
          if (!name) continue;
          const a = get(l.assignedUserId!, name);
          a.leads++;
          if (l.status === 'won') a.won++;
        }
        const rows = [...agg.values()]
          .sort((a, b) => b.revenue - a.revenue || b.deals - a.deals)
          .slice(0, 8)
          .map((a) => ({ manager: a.name, deals: a.deals, conv: a.leads ? round((a.won / a.leads) * 100) : null, revenue: round(a.revenue) }));
        return {
          type: 'table',
          cols: [
            { key: 'manager', kind: 'person' },
            { key: 'deals', kind: 'int' },
            { key: 'conv', kind: 'pct' },
            { key: 'revenue', kind: 'money' },
          ],
          rows,
        };
      }
      case 'calls_kpi':
      case 'calls_miss': {
        let calls = await this.calls();
        if (key === 'calls_miss') calls = calls.filter((c) => c.direction === 'inbound' && MISSED_CALL_STATUSES.has(c.status));
        const cur = calls.filter((c) => this.inCur(c.t)).length;
        const prev = calls.filter((c) => this.inPrev(c.t)).length;
        const delta = pctDelta(cur, prev);
        return { type: 'kpi', value: cur, format: 'int', delta, good: goodOf(delta, key === 'calls_kpi' ? 'up' : 'down'), spark: this.series(calls, (c) => c.t) };
      }
      case 'calls_hours': {
        const calls = (await this.calls()).filter((c) => this.inCur(c.t));
        const byHour = new Array(24).fill(0);
        for (const c of calls) byHour[this.local(c.t).h]++;
        const used = byHour.map((v, h) => (v ? h : -1)).filter((h) => h >= 0);
        const from = Math.min(9, ...used);
        const to = Math.max(19, ...used);
        const labels = Array.from({ length: to - from + 1 }, (_, i) => from + i);
        return { type: 'col', labels, data: labels.map((h) => byHour[h]) };
      }
      case 'book_load': {
        const [cur, prev] = await Promise.all([
          this.svc.occupancy(this.tenantId, this.P.start, this.P.end),
          this.svc.occupancy(this.tenantId, this.P.prevStart, this.P.prevEnd),
        ]);
        const delta: AuraDelta = { kind: 'pp', value: round(cur.occupancyRate - prev.occupancyRate, 1) };
        return { type: 'kpi', value: cur.occupancyRate, format: 'pct', delta, good: goodOf(delta, 'up'), spark: null };
      }
      case 'book_count': {
        const res = await this.reservations();
        const t = (r: Reservation) => r.createdAt.getTime();
        const cur = res.filter((r) => this.inCur(t(r))).length;
        const prev = res.filter((r) => this.inPrev(t(r))).length;
        const delta = pctDelta(cur, prev);
        return { type: 'kpi', value: cur, format: 'int', delta, good: goodOf(delta, 'up'), spark: this.series(res, t) };
      }
      case 'book_noshow': {
        const res = (await this.reservations()).filter((r) => r.startAt.getTime() <= Date.now() && !BOOKING_CANCELLED.has(r.status));
        const rate = (a: Reservation[]) => (a.length ? (a.filter((r) => r.status === 'no_show').length / a.length) * 100 : 0);
        const cur = res.filter((r) => this.inCur(r.startAt.getTime()));
        const prev = res.filter((r) => this.inPrev(r.startAt.getTime()));
        const delta: AuraDelta = prev.length ? { kind: 'pp', value: round(rate(cur) - rate(prev), 1) } : null;
        const spark = this.P.buckets.map((b) => round(rate(res.filter((r) => r.startAt.getTime() >= b.s && r.startAt.getTime() < b.e)), 1));
        return { type: 'kpi', value: cur.length ? round(rate(cur), 1) : null, format: 'pct', delta, good: goodOf(delta, 'down'), spark };
      }
      case 'book_heat': {
        const res = (await this.reservations()).filter((r) => this.inCur(r.startAt.getTime()) && !BOOKING_CANCELLED.has(r.status));
        const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
        for (const r of res) {
          const { h, dow } = this.local(r.startAt.getTime());
          grid[dow][h]++;
        }
        const used: number[] = [];
        grid.forEach((row) => row.forEach((v, h) => v && used.push(h)));
        const from = Math.min(9, ...used);
        const to = Math.max(20, ...used);
        const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
        return { type: 'heat', hours, values: grid.map((row) => hours.map((h) => row[h])) };
      }
      case 'stock_kpi': {
        const [products, moves] = await Promise.all([this.products(), this.movements()]);
        const ids = new Set(products.map((p) => p.id));
        const total = products.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
        const own = moves.filter((m) => ids.has(m.productId) && !m.variantId);
        const levelAt = (t: number) => total - own.filter((m) => m.createdAt.getTime() > t).reduce((s, m) => s + m.quantityDelta, 0);
        const startLevel = levelAt(this.P.start);
        const delta = pctDelta(total, startLevel);
        return { type: 'kpi', value: total, format: 'int', unit: 'pcs', delta, good: null, spark: this.P.buckets.map((b) => levelAt(Math.min(b.e, Date.now()))) };
      }
      case 'stock_top': {
        const [products, moves] = await Promise.all([this.products(), this.movements()]);
        const name = new Map(products.map((p) => [p.id, p.name]));
        const m = new Map<string, number>();
        for (const mv of moves) {
          if (!(mv.type === 'sale' || mv.source === 'sale') || mv.quantityDelta >= 0) continue;
          if (!this.inCur(mv.createdAt.getTime()) || !name.has(mv.productId)) continue;
          m.set(mv.productId, (m.get(mv.productId) || 0) - mv.quantityDelta);
        }
        const items = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, value]) => ({ name: name.get(id)!, value }));
        return { type: 'bar', format: 'int', unit: 'pcs', items };
      }
      case 'stock_low': {
        const [products, moves] = await Promise.all([this.products(), this.movements()]);
        const since = Date.now() - 30 * DAY;
        const sold = new Map<string, number>();
        for (const mv of moves) {
          if (mv.createdAt.getTime() < since || mv.quantityDelta >= 0) continue;
          if (!(mv.type === 'sale' || mv.type === 'out' || mv.source === 'sale')) continue;
          sold.set(mv.productId, (sold.get(mv.productId) || 0) - mv.quantityDelta);
        }
        const rows = products
          .map((p) => {
            const qty = Number(p.quantity) || 0;
            const perDay = (sold.get(p.id) || 0) / 30;
            const left = perDay > 0 ? Math.floor(qty / perDay) : null;
            const low = (p.lowStockThreshold != null && qty <= p.lowStockThreshold) || (left != null && left <= 14);
            return { p, qty, left, low };
          })
          .filter((x) => x.low)
          .sort((a, b) => (a.left ?? 9999) - (b.left ?? 9999) || a.qty - b.qty)
          .slice(0, 6);
        return {
          type: 'table',
          cols: [
            { key: 'product', kind: 'text' },
            { key: 'sku', kind: 'text' },
            { key: 'qty', kind: 'int' },
            { key: 'left', kind: 'days' },
          ],
          rows: rows.map((x) => ({ product: x.p.name, sku: x.p.sku || '—', qty: x.qty, left: x.left })),
        };
      }
      case 'fin_profit': {
        if (moneyBlocked()) return { error: 'amounts_hidden' };
        const [inc, sp] = await Promise.all([this.income(), this.spend()]);
        const net = (inRange: (t: number) => boolean) =>
          inc.filter((x) => inRange(x.t)).reduce((s, x) => s + x.amount, 0) - sp.filter((x) => inRange(x.t)).reduce((s, x) => s + x.amount, 0);
        const cur = net(this.inCur);
        const prev = net(this.inPrev);
        const delta = prev > 0 && !this.hourly ? pctDelta(cur, prev) : null;
        const a = this.series(inc, (x) => x.t, (x) => x.amount);
        const b = this.series(sp, (x) => x.t, (x) => x.amount);
        return { type: 'kpi', value: round(cur), format: 'money', delta, good: goodOf(delta, 'up'), spark: a.map((v, i) => round(v - b[i])) };
      }
      case 'fin_pl': {
        if (moneyBlocked()) return { error: 'amounts_hidden' };
        const [inc, sp] = await Promise.all([this.income(), this.spend()]);
        const local = new Date(Date.now() + this.P.off);
        const n = this.P.key === 'year' ? 12 : 6;
        const months: Array<{ s: number; e: number; label: string }> = [];
        for (let i = n - 1; i >= 0; i--) {
          const y = local.getUTCFullYear();
          const m = local.getUTCMonth() - i;
          months.push({ s: Date.UTC(y, m, 1) - this.P.off, e: Date.UTC(y, m + 1, 1) - this.P.off, label: new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7) });
        }
        const sumIn = (arr: Array<{ t: number; amount: number }>, b: { s: number; e: number }) =>
          round(arr.filter((x) => x.t >= b.s && x.t < b.e).reduce((s, x) => s + x.amount, 0));
        return { type: 'col2', format: 'money', labels: months.map((m) => m.label), a: months.map((m) => sumIn(inc, m)), b: months.map((m) => sumIn(sp, m)) };
      }
      case 'fin_mix': {
        if (moneyBlocked()) return { error: 'amounts_hidden' };
        const inc = (await this.income()).filter((x) => this.inCur(x.t));
        const items = (['sales', 'bookings', 'hotels'] as const)
          .map((k) => ({ key: k, name: k, value: round(inc.filter((x) => x.kind === k).reduce((s, x) => s + x.amount, 0)) }))
          .filter((x) => x.value > 0);
        return { type: 'donut', format: 'money', items };
      }
      case 'mk_spend': {
        if (moneyBlocked()) return { error: 'amounts_hidden' };
        const sp = await this.spend();
        const cur = sp.filter((x) => this.inCur(x.t)).reduce((s, x) => s + x.amount, 0);
        const prev = sp.filter((x) => this.inPrev(x.t)).reduce((s, x) => s + x.amount, 0);
        return { type: 'kpi', value: round(cur), format: 'money', delta: this.hourly ? null : pctDelta(cur, prev), good: null, spark: this.series(sp, (x) => x.t, (x) => x.amount) };
      }
      case 'mk_cpl': {
        if (moneyBlocked()) return { error: 'amounts_hidden' };
        const [sp, leads] = await Promise.all([this.spend(), this.leads()]);
        const cpl = (r: (t: number) => boolean) => {
          const n = leads.filter((l) => r(l.createdAt.getTime())).length;
          return n ? sp.filter((x) => r(x.t)).reduce((s, x) => s + x.amount, 0) / n : null;
        };
        const cur = cpl(this.inCur);
        const prev = cpl(this.inPrev);
        const delta = cur != null && prev && !this.hourly ? pctDelta(cur, prev) : null;
        const spark = this.P.buckets.map((b) => {
          const n = leads.filter((l) => l.createdAt.getTime() >= b.s && l.createdAt.getTime() < b.e).length;
          return n ? round(sp.filter((x) => x.t >= b.s && x.t < b.e).reduce((s, x) => s + x.amount, 0) / n) : 0;
        });
        return { type: 'kpi', value: cur != null ? round(cur) : null, format: 'money', delta, good: goodOf(delta, 'down'), spark };
      }
      case 'mk_channels': {
        if (moneyBlocked()) return { error: 'amounts_hidden' };
        const sp = (await this.spend()).filter((x) => this.inCur(x.t));
        const m = new Map<string, number>();
        for (const x of sp) m.set(x.channel, (m.get(x.channel) || 0) + x.amount);
        const items = [...m.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value: round(value) }));
        return { type: 'bar', format: 'money', items };
      }
      case 'compare': {
        const rows = await this.revenueSales();
        const cur = rows.filter((r) => this.inCur(r.t));
        const prev = rows.filter((r) => this.inPrev(r.t));
        return {
          type: 'line',
          format: 'money',
          current: this.series(rows, (r) => r.t, (r) => r.amount),
          previous: this.series(rows, (r) => r.t, (r) => r.amount, true),
          total: round(cur.reduce((s, r) => s + r.amount, 0)),
          prevTotal: round(prev.reduce((s, r) => s + r.amount, 0)),
        };
      }
      case 'alerts':
        return this.alerts(teamGoal);
    }
    return this.widgetV2(key, teamGoal);
  }

  /* ---------- виджеты «стеклянных» шаблонов (2026-10-17) ---------- */

  /** Линия «текущий vs прошлый период» по любому списку событий. */
  private lineOf<T>(items: T[], time: (x: T) => number, val: (x: T) => number = () => 1, format: AuraFormat = 'int'): AuraWidgetData {
    const sum = (r: (t: number) => boolean) => round(items.filter((x) => r(time(x))).reduce((a, x) => a + val(x), 0), 2);
    return {
      type: 'line',
      format,
      current: this.series(items, time, val),
      previous: this.series(items, time, val, true),
      total: sum(this.inCur),
      prevTotal: sum(this.inPrev),
    };
  }

  /** Границы месяца в локальном времени зрителя. */
  private month() {
    const now = Date.now();
    const local = new Date(now + this.P.off);
    const y = local.getUTCFullYear();
    const m = local.getUTCMonth();
    const start = Date.UTC(y, m, 1) - this.P.off;
    const end = Date.UTC(y, m + 1, 1) - this.P.off;
    const prevStart = Date.UTC(y, m - 1, 1) - this.P.off;
    const frac = Math.min(1, Math.max(0, (now - start) / (end - start)));
    const prevSame = prevStart + frac * (start - prevStart);
    return { now, start, end, prevStart, prevSame, frac, day: local.getUTCDate(), days: Math.round((end - start) / DAY) };
  }

  /** Прогноз на конец месяца по текущему темпу. */
  private forecastOf(items: Array<{ t: number; amount: number }>, target: number | null): AuraWidgetData {
    const M = this.month();
    const sum = (a: number, b: number) => round(items.filter((x) => x.t >= a && x.t < b).reduce((s, x) => s + x.amount, 0));
    const done = sum(M.start, M.now + 1);
    // в первые часы месяца темп не показателен — прогноз = факт
    const projected = M.frac > 0.03 ? round(done / M.frac) : done;
    const cumulative = (start: number, days: number, upTo: number) => {
      const out: number[] = [];
      let acc = 0;
      for (let d = 0; d < days; d++) {
        const a = start + d * DAY;
        if (a > upTo) break;
        acc += items.filter((x) => x.t >= a && x.t < Math.min(a + DAY, upTo + 1)).reduce((s, x) => s + x.amount, 0);
        out.push(round(acc));
      }
      return out;
    };
    const prevDays = Math.round((M.start - M.prevStart) / DAY);
    return {
      type: 'forecast',
      format: 'money',
      done,
      projected,
      prev: sum(M.prevStart, M.start),
      prevSameDay: sum(M.prevStart, M.prevSame),
      target,
      day: M.day,
      days: M.days,
      series: cumulative(M.start, M.days, M.now),
      prevSeries: cumulative(M.prevStart, prevDays, M.start - 1),
    };
  }

  /** Неделя календаря начинается с понедельника; год — 53 недели, иначе 20. */
  private calStart() {
    const weeks = this.P.key === 'year' ? 53 : 20;
    const local = new Date(Date.now() + this.P.off);
    const todayLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    const dow = (local.getUTCDay() + 6) % 7;
    const startLocal = todayLocal - (dow + (weeks - 1) * 7) * DAY;
    return { startLocal, start: startLocal - this.P.off, days: Math.round((todayLocal - startLocal) / DAY) + 1 };
  }

  private calOf<T>(items: T[], time: (x: T) => number, val: (x: T) => number, format: AuraFormat): AuraWidgetData {
    const C = this.calStart();
    const values = new Array(C.days).fill(0);
    for (const it of items) {
      const i = Math.floor((time(it) - C.start) / DAY);
      if (i >= 0 && i < C.days) values[i] += val(it);
    }
    return { type: 'cal', format, start: new Date(C.startLocal).toISOString().slice(0, 10), values: values.map((v) => round(v, 2)) };
  }

  private maskName(name: string | null, own: boolean) {
    return this.scope.maskNames && !own ? '•••' : name;
  }

  private static phoneTail(n: string | null) {
    if (!n) return null;
    const d = n.replace(/[^\d+]/g, '');
    return d.length > 4 ? `•••${d.slice(-4)}` : d;
  }

  private async leadStream(limit: number): Promise<AuraStreamItem[]> {
    const leads = await this.leads();
    const me = this.scope.staff?.id;
    return [...leads]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((l) => ({
        kind: 'lead' as const,
        at: l.createdAt.toISOString(),
        title: this.maskName(l.name || l.email || l.phone || null, !!me && l.assignedUserId === me),
        sub: l.source || 'unknown',
        value: null,
        format: null,
        status: l.status,
      }));
  }

  private async saleStream(limit: number): Promise<AuraStreamItem[]> {
    const rows = await this.sales();
    return [...rows]
      .filter((r) => r.t <= Date.now())
      .sort((a, b) => b.t - a.t)
      .slice(0, limit)
      .map((r) => ({
        kind: 'sale' as const,
        at: new Date(r.t).toISOString(),
        title: this.maskName(r.name, r.own),
        sub: r.managerName,
        value: this.scope.maskAmounts && !r.own ? null : round(r.amount),
        format: 'money' as const,
        status: r.status,
      }));
  }

  private async callStream(limit: number): Promise<AuraStreamItem[]> {
    const calls = await this.calls();
    const top = [...calls].sort((a, b) => b.t - a.t).slice(0, limit);
    const leads = await this.svc.loadLeadsByIds(this.tenantId, [...new Set(top.map((c) => c.leadId).filter(Boolean) as string[])]);
    const leadName = new Map(leads.map((l) => [l.id, l.name]));
    return top.map((c) => ({
      kind: 'call' as const,
      at: new Date(c.t).toISOString(),
      title: this.maskName((c.leadId && leadName.get(c.leadId)) || Ctx.phoneTail(c.number), c.own),
      sub: c.direction,
      value: c.duration,
      format: null,
      status: c.direction === 'inbound' && MISSED_CALL_STATUSES.has(c.status) ? 'missed' : c.status,
    }));
  }

  private async bookingStream(limit: number, upcoming: boolean): Promise<AuraStreamItem[]> {
    const [res, locs] = await Promise.all([this.reservations(), this.svc.loadLocations(this.tenantId)]);
    const loc = new Map(locs.map((l) => [l.id, l.name]));
    const me = this.scope.staff?.id;
    const now = Date.now();
    const list = upcoming
      ? res.filter((r) => r.startAt.getTime() >= now && !BOOKING_CANCELLED.has(r.status) && r.status !== 'draft').sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
      : [...res].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return list.slice(0, limit).map((r) => ({
      kind: 'booking' as const,
      at: (upcoming ? r.startAt : r.createdAt).toISOString(),
      title: this.maskName(r.customerName || null, !!me && (r.staffUserId === me || r.assignedUserId === me)),
      sub: loc.get(r.locationId) || null,
      value: r.participants > 1 ? r.participants : null,
      format: null,
      status: r.status,
    }));
  }

  private stockState() {
    return this.once('stockState', async () => {
      const products = await this.products();
      // «на исходе» — порог товара или запас меньше чем на 14 дней (как в stock_low, но без лимита 6 строк)
      const moves = await this.movements();
      const since = Date.now() - 30 * DAY;
      const sold = new Map<string, number>();
      for (const mv of moves) {
        if (mv.createdAt.getTime() < since || mv.quantityDelta >= 0) continue;
        if (!(mv.type === 'sale' || mv.type === 'out' || mv.source === 'sale')) continue;
        sold.set(mv.productId, (sold.get(mv.productId) || 0) - mv.quantityDelta);
      }
      let ok = 0;
      let lowN = 0;
      let out = 0;
      for (const p of products) {
        const qty = Number(p.quantity) || 0;
        const perDay = (sold.get(p.id) || 0) / 30;
        const left = perDay > 0 ? Math.floor(qty / perDay) : null;
        if (qty <= 0) out++;
        else if ((p.lowStockThreshold != null && qty <= p.lowStockThreshold) || (left != null && left <= 14)) {
          lowN++;
        } else ok++;
      }
      return { ok, low: lowN, out, products };
    });
  }

  private async widgetV2(key: string, teamGoal: number | null): Promise<AuraWidgetResult> {
    const moneyBlocked = () => this.scope.maskAmounts;
    switch (key) {
      /* ---- лиды ---- */
      case 'leads_cal': {
        const C = this.calStart();
        const leads = await this.leadsSince(Math.min(C.start, this.loadFrom));
        return this.calOf(leads, (l) => l.createdAt.getTime(), () => 1, 'int');
      }
      case 'leads_status': {
        const leads = (await this.leads()).filter((l) => this.inCur(l.createdAt.getTime()));
        const keys = ['new', 'in_progress', 'waiting', 'won', 'lost'];
        return { type: 'segbar', format: 'int', items: keys.map((k) => ({ key: k, value: leads.filter((l) => l.status === k).length })) };
      }
      case 'leads_gauge': {
        const leads = (await this.leads()).filter((l) => this.inCur(l.createdAt.getTime()));
        const won = leads.filter((l) => l.status === 'won').length;
        const lost = leads.filter((l) => l.status === 'lost').length;
        return {
          type: 'gauge',
          value: leads.length ? round((won / leads.length) * 100, 1) : null,
          rows: [
            { key: 'won', value: won, tone: 'good' },
            { key: 'in_work', value: leads.length - won - lost, tone: 'neutral' },
            { key: 'lost', value: lost, tone: 'bad' },
          ],
        };
      }
      case 'leads_stream':
        return { type: 'stream', items: await this.leadStream(7) };

      /* ---- продажи ---- */
      case 'deals_forecast': {
        if (moneyBlocked()) return { error: 'amounts_hidden' };
        const M = this.month();
        const rows = await this.revenueSales(Math.min(this.loadFrom, M.prevStart));
        return this.forecastOf(rows.map((r) => ({ t: r.t, amount: r.amount })), teamGoal);
      }
      case 'deals_split': {
        const [rows, first] = await Promise.all([this.revenueSales(), this.svc.loadFirstSales(this.tenantId)]);
        let a = 0;
        let b = 0;
        for (const r of rows.filter((x) => this.inCur(x.t))) {
          const f = r.client ? first.get(r.client) : undefined;
          // первая продажа клиента (или без клиента) — «новый»
          if (f != null && r.t > f + 60_000) b += r.amount;
          else a += r.amount;
        }
        return { type: 'split', format: 'money', a: { key: 'new_clients', value: round(a) }, b: { key: 'repeat_clients', value: round(b) } };
      }
      case 'deals_cal': {
        const C = this.calStart();
        const rows = await this.revenueSales(Math.min(C.start, this.loadFrom));
        return this.calOf(rows, (r) => r.t, (r) => r.amount, 'money');
      }
      case 'deals_stream':
        return { type: 'stream', items: await this.saleStream(7) };

      /* ---- команда ---- */
      case 'team_load': {
        let open = excludeTrashedLeads(await this.svc.loadOpenLeads(this.tenantId));
        if (this.scope.leadFilter) open = open.filter(this.scope.leadFilter);
        if (this.filters.channel) open = open.filter((l) => (l.source || 'unknown') === this.filters.channel);
        const staff = new Map((await this.staffAll()).map((x) => [x.id, x.fullName || x.email]));
        const m = new Map<string, number>();
        for (const l of open) {
          const name = (l.assignedUserId && staff.get(l.assignedUserId)) || '—';
          m.set(name, (m.get(name) || 0) + 1);
        }
        const items = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
        return { type: 'bar', format: 'int', people: true, items };
      }

      /* ---- звонки ---- */
      case 'calls_line': {
        const calls = await this.calls();
        return this.lineOf(calls, (c) => c.t);
      }
      case 'calls_split': {
        const calls = (await this.calls()).filter((c) => this.inCur(c.t));
        return {
          type: 'split',
          format: 'int',
          a: { key: 'inbound', value: calls.filter((c) => c.direction === 'inbound').length },
          b: { key: 'outbound', value: calls.filter((c) => c.direction !== 'inbound').length },
        };
      }
      case 'calls_gauge': {
        // только входящие: доля исходящих — в calls_split, иначе проценты строк не сходятся с центром
        const inbound = (await this.calls()).filter((c) => this.inCur(c.t) && c.direction === 'inbound');
        const missed = inbound.filter((c) => MISSED_CALL_STATUSES.has(c.status)).length;
        return {
          type: 'gauge',
          value: inbound.length ? round(((inbound.length - missed) / inbound.length) * 100, 1) : null,
          rows: [
            { key: 'answered', value: inbound.length - missed, tone: 'good' },
            { key: 'missed', value: missed, tone: 'bad' },
          ],
        };
      }
      case 'calls_stream':
        return { type: 'stream', items: await this.callStream(7) };

      /* ---- брони ---- */
      case 'book_line': {
        const res = await this.reservations();
        return this.lineOf(res, (r) => r.createdAt.getTime());
      }
      case 'book_gauge': {
        const res = (await this.reservations()).filter((r) => this.inCur(r.startAt.getTime()) && r.startAt.getTime() <= Date.now() && r.status !== 'draft');
        const done = res.filter((r) => r.status === 'completed' || r.status === 'checked_in' || r.status === 'in_progress').length;
        const ns = res.filter((r) => r.status === 'no_show').length;
        const cancelled = res.filter((r) => BOOKING_CANCELLED.has(r.status)).length;
        const base = done + ns + cancelled;
        return {
          type: 'gauge',
          value: base ? round((done / base) * 100, 1) : null,
          rows: [
            { key: 'visited', value: done, tone: 'good' },
            { key: 'no_show', value: ns, tone: 'bad' },
            { key: 'cancelled', value: cancelled, tone: 'warn' },
          ],
        };
      }
      case 'book_status': {
        const res = (await this.reservations()).filter((r) => this.inCur(r.startAt.getTime()) && r.status !== 'draft');
        const group = (st: string) =>
          st === 'pending' ? 'pending' : st === 'completed' ? 'completed' : st === 'no_show' ? 'no_show' : BOOKING_CANCELLED.has(st) ? 'cancelled' : 'confirmed';
        const keys = ['pending', 'confirmed', 'completed', 'no_show', 'cancelled'];
        return { type: 'segbar', format: 'int', items: keys.map((k) => ({ key: k, value: res.filter((r) => group(r.status) === k).length })) };
      }
      case 'book_upcoming':
        return { type: 'stream', items: await this.bookingStream(7, true) };

      /* ---- склад ---- */
      case 'stock_value': {
        const products = await this.products();
        const value = products.reduce((s, p) => s + Math.max(0, Number(p.quantity) || 0) * this.conv(p.price, p.currency), 0);
        return { type: 'kpi', value: round(value), format: 'money', delta: null, good: null, spark: null };
      }
      case 'stock_health': {
        const st = await this.stockState();
        return {
          type: 'segbar',
          format: 'int',
          items: [
            { key: 'ok', value: st.ok, tone: 'good' },
            { key: 'low', value: st.low, tone: 'warn' },
            { key: 'out', value: st.out, tone: 'bad' },
          ],
        };
      }
      case 'stock_gauge': {
        const st = await this.stockState();
        const n = st.ok + st.low + st.out;
        return {
          type: 'gauge',
          value: n ? round((st.ok / n) * 100, 1) : null,
          rows: [
            { key: 'ok', value: st.ok, tone: 'good' },
            { key: 'low', value: st.low, tone: 'warn' },
            { key: 'out', value: st.out, tone: 'bad' },
          ],
        };
      }

      /* ---- финансы ---- */
      case 'fin_income': {
        if (moneyBlocked()) return { error: 'amounts_hidden' };
        const inc = await this.income();
        const sum = (r: (t: number) => boolean) => inc.filter((x) => r(x.t)).reduce((s, x) => s + x.amount, 0);
        const delta = pctDelta(sum(this.inCur), sum(this.inPrev));
        return { type: 'kpi', value: round(sum(this.inCur)), format: 'money', delta, good: goodOf(delta, 'up'), spark: this.series(inc, (x) => x.t, (x) => x.amount) };
      }
      case 'fin_margin': {
        if (moneyBlocked()) return { error: 'amounts_hidden' };
        const [inc, sp] = await Promise.all([this.income(), this.spend()]);
        const margin = (r: (t: number) => boolean) => {
          const i = inc.filter((x) => r(x.t)).reduce((s, x) => s + x.amount, 0);
          if (!i) return null;
          return ((i - sp.filter((x) => r(x.t)).reduce((s, x) => s + x.amount, 0)) / i) * 100;
        };
        const cur = margin(this.inCur);
        const prev = margin(this.inPrev);
        const delta: AuraDelta = cur != null && prev != null && !this.hourly ? { kind: 'pp', value: round(cur - prev, 1) } : null;
        return { type: 'kpi', value: cur != null ? round(cur, 1) : null, format: 'pct', delta, good: goodOf(delta, 'up'), spark: null };
      }
      case 'fin_line': {
        if (moneyBlocked()) return { error: 'amounts_hidden' };
        const inc = await this.income();
        return this.lineOf(inc, (x) => x.t, (x) => x.amount, 'money');
      }
      case 'fin_forecast': {
        if (moneyBlocked()) return { error: 'amounts_hidden' };
        return this.forecastOf(await this.income(), null);
      }

      /* ---- маркетинг ---- */
      case 'mk_line': {
        if (moneyBlocked()) return { error: 'amounts_hidden' };
        const sp = await this.spend();
        return this.lineOf(sp, (x) => x.t, (x) => x.amount, 'money');
      }
      case 'mk_mix': {
        if (moneyBlocked()) return { error: 'amounts_hidden' };
        const sp = (await this.spend()).filter((x) => this.inCur(x.t));
        const m = new Map<string, number>();
        for (const x of sp) m.set(x.channel, (m.get(x.channel) || 0) + x.amount);
        const items = [...m.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ key: name, name, value: round(value) }));
        return { type: 'donut', format: 'money', items };
      }

      /* ---- общие ---- */
      case 'hero':
        return this.hero();
      case 'setup': {
        const st = await this.svc.setupState(this.tenantId);
        const can = this.scope.can;
        const items: Array<{ key: string; done: boolean }> = [];
        if (can.has('leads')) items.push({ key: 'lead', done: st.lead });
        items.push({ key: 'team', done: st.team });
        if (can.has('deals')) items.push({ key: 'sale', done: st.sale });
        if (can.has('calls')) items.push({ key: 'calls', done: st.call });
        if (can.has('marketing')) items.push({ key: 'ads', done: st.ads });
        if (can.has('stock')) items.push({ key: 'products', done: st.product });
        if (can.has('booking')) items.push({ key: 'booking', done: st.booking });
        items.push({ key: 'aura', done: st.aura });
        return { type: 'check', items };
      }
      case 'stream': {
        const can = this.scope.can;
        const parts = await Promise.all([
          can.has('leads') ? this.leadStream(8) : [],
          can.has('deals') ? this.saleStream(8) : [],
          can.has('booking') ? this.bookingStream(8, false) : [],
          can.has('calls') ? this.callStream(8) : [],
        ]);
        const items = parts
          .flat()
          .filter((x) => new Date(x.at).getTime() <= Date.now() + 60_000)
          .sort((a, b) => b.at.localeCompare(a.at))
          .slice(0, 8);
        return { type: 'stream', items };
      }
      case 'pulse': {
        const keys = (['leads', 'deals', 'calls', 'booking', 'stock', 'marketing'] as AuraSourceKey[]).filter((k) => this.scope.can.has(k));
        const items = await Promise.all(keys.map(async (k) => ({ key: k, ...(await this.svc.lastActivity(this.tenantId, k)) })));
        return { type: 'status', items };
      }
      case 'activity': {
        const can = this.scope.can;
        const series: Array<{ key: string; data: number[] }> = [];
        if (can.has('leads')) series.push({ key: 'leads', data: this.series(await this.leads(), (l) => l.createdAt.getTime()) });
        if (can.has('deals')) series.push({ key: 'sales', data: this.series(await this.sales(), (r) => r.t) });
        if (can.has('booking')) series.push({ key: 'bookings', data: this.series(await this.reservations(), (r) => r.createdAt.getTime()) });
        if (can.has('calls')) series.push({ key: 'calls', data: this.series(await this.calls(), (c) => c.t) });
        return { type: 'multi', format: 'int', series };
      }
    }
    return { error: 'failed' };
  }

  /** Приветствие: цифры за сегодня по доступным разделам. */
  private async hero(): Promise<AuraWidgetResult> {
    const local = new Date(Date.now() + this.P.off);
    const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - this.P.off;
    const today = (t: number) => t >= midnight && t <= Date.now();
    const can = this.scope.can;
    const items: Array<{ key: string; value: number | null; format: AuraFormat }> = [];
    if (can.has('leads')) items.push({ key: 'leads', value: (await this.leads()).filter((l) => today(l.createdAt.getTime())).length, format: 'int' });
    if (can.has('deals')) {
      const rev = (await this.revenueSales()).filter((r) => today(r.t));
      items.push({ key: 'revenue', value: round(rev.reduce((s, r) => s + r.amount, 0)), format: 'money' });
    }
    if (can.has('booking')) items.push({ key: 'bookings', value: (await this.reservations()).filter((r) => today(r.startAt.getTime()) && !BOOKING_CANCELLED.has(r.status)).length, format: 'int' });
    if (can.has('calls')) items.push({ key: 'calls', value: (await this.calls()).filter((c) => today(c.t)).length, format: 'int' });
    const full = this.scope.staff?.fullName?.trim() || '';
    return { type: 'hero', name: full ? full.split(/\s+/)[0] : null, items: items.slice(0, 4) };
  }

  /** «Требует внимания» — только по разделам, к которым у зрителя есть доступ. */
  private async alerts(teamGoal: number | null): Promise<AuraWidgetResult> {
    const can = this.scope.can;
    const items: Array<{ kind: string; n?: number; pct?: number; name?: string }> = [];
    if (can.has('leads')) {
      let stale = excludeTrashedLeads(await this.svc.countStaleLeads(this.tenantId, new Date(Date.now() - 7 * DAY)));
      if (this.scope.leadFilter) stale = stale.filter(this.scope.leadFilter);
      if (stale.length) items.push({ kind: 'stale_leads', n: stale.length });
      const lost = (await this.leads()).filter((l) => l.status === 'lost' && this.inCur(l.createdAt.getTime())).length;
      if (lost) items.push({ kind: 'lost_leads', n: lost });
    }
    if (can.has('stock')) {
      const low = await this.widget('stock_low', null);
      if ('type' in low && low.type === 'table' && low.rows.length) {
        const first = low.rows[0];
        items.push({ kind: 'low_stock', n: low.rows.length, name: String(first.product || ''), ...(first.left != null ? { pct: Number(first.left) } : {}) });
      }
    }
    if (can.has('calls')) {
      const missed = (await this.calls()).filter((c) => this.inCur(c.t) && c.direction === 'inbound' && MISSED_CALL_STATUSES.has(c.status)).length;
      if (missed) items.push({ kind: 'missed_calls', n: missed });
    }
    if (can.has('booking')) {
      const ns = await this.widget('book_noshow', null);
      if ('value' in ns && ns.value != null && ns.value >= 10) items.push({ kind: 'no_show', pct: ns.value });
    }
    if (can.has('deals') && teamGoal) {
      const g = await this.widget('team_goal', teamGoal);
      if ('pct' in g && g.pct != null) items.push({ kind: 'goal', pct: g.pct, n: 'daysLeft' in g ? g.daysLeft : undefined });
    }
    if (!items.length) items.push({ kind: 'all_good' });
    return { type: 'list', items: items.slice(0, 6) };
  }

  /* ---------- значения фильтров шапки ---------- */

  async filterOptions(f: AuraFilterKey): Promise<Array<{ id: string; name: string }>> {
    if (f === 'manager') {
      const staff = (await this.staffAll()).filter((s) => (s as any).isActive !== false);
      const me = this.scope.staff;
      const list = this.scope.ownOnly && me ? staff.filter((s) => s.id === me.id) : staff;
      return list.map((s) => ({ id: s.id, name: s.fullName || s.email })).sort((a, b) => a.name.localeCompare(b.name));
    }
    if (f === 'channel') {
      if (!this.scope.can.has('leads')) return [];
      const saved = this.filters.channel;
      const all = excludeTrashedLeads(await this.svc.loadLeads(this.tenantId, Date.now() - 180 * DAY));
      const keys = new Set(all.map((l) => l.source || 'unknown'));
      if (saved) keys.add(saved);
      return [...keys].map((k) => ({ id: k, name: k }));
    }
    if (f === 'branch') {
      if (!this.scope.can.has('booking')) return [];
      return (await this.svc.loadLocations(this.tenantId)).map((l) => ({ id: l.id, name: l.name }));
    }
    if (!this.scope.can.has('stock')) return [];
    return (await this.svc.loadProducts(this.tenantId))
      .map((p) => ({ id: p.id, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 300);
  }
}
