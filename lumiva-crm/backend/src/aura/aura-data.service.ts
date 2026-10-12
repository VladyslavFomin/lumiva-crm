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
  AURA_SOURCE_PERMISSION,
  AURA_WIDGET_BY_KEY,
  type AuraFilterKey,
  type AuraPeriod,
  type AuraSourceKey,
} from './aura-catalog';
import { isCustomKey, type AuraCustomWidget } from './aura-custom';
import { computeCustom, listWorkspaceTables } from './aura-custom-data';

/* ───────────────────────── типы ответа ───────────────────────── */

export type AuraFormat = 'int' | 'money' | 'pct' | 'num';
export type AuraDelta = { kind: 'pct' | 'pp'; value: number } | null;
export type AuraWidgetData =
  | { type: 'kpi'; value: number | null; format: AuraFormat; unit?: 'pcs'; delta: AuraDelta; good: boolean | null; spark: number[] | null }
  | { type: 'line'; format: AuraFormat; current: number[]; previous: number[]; total: number; prevTotal: number }
  | { type: 'donut'; format: AuraFormat; items: Array<{ key?: string; name: string; value: number }> }
  | { type: 'funnel'; steps: Array<{ key: string; value: number }> }
  | { type: 'table'; cols: Array<{ key: string; kind: 'text' | 'person' | 'chip' | 'money' | 'int' | 'pct' | 'days' }>; rows: Array<Record<string, string | number | null>> }
  | { type: 'bar'; format: AuraFormat; unit?: 'pcs'; people?: boolean; items: Array<{ name: string; value: number }> }
  | { type: 'col'; labels: number[]; data: number[] }
  | { type: 'col2'; format: AuraFormat; labels: string[]; a: number[]; b: number[] }
  | { type: 'heat'; hours: number[]; values: number[][] }
  | { type: 'list'; items: Array<{ kind: string; n?: number; pct?: number; name?: string }> }
  | { type: 'goal'; target: number | null; done: number; pct: number | null; daysLeft: number };

export type AuraWidgetResult = AuraWidgetData | { error: 'denied' | 'amounts_hidden' | 'failed' };

export type AuraDataResponse = {
  period: { key: AuraPeriod; from: string; to: string; granularity: 'hour' | 'day' | 'week' | 'month'; labels: string[] };
  currency: string;
  generatedAt: string;
  own: boolean;
  widgets: Record<string, AuraWidgetResult>;
  filterOptions: Partial<Record<AuraFilterKey, Array<{ id: string; name: string }>>>;
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
    return { tenantId, role, staff, can, leadFilter, ownOnly, maskAmounts, maskNames, extra };
  }

  /* ---------- расчёт ---------- */

  async compute(
    scope: AuraScope,
    input: { widgets: string[]; period: AuraPeriod; filters?: AuraFilters; breakdown?: AuraFilterKey[]; goals?: { team_goal?: number | null }; tz?: string; custom?: AuraCustomWidget[] },
  ): Promise<AuraDataResponse> {
    const tenantId = scope.tenantId;
    const tz = this.safeTz(input.tz);
    const P = buildPeriod(input.period, tz);
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId }, select: ['id', 'primaryCurrency'] });
    const currency = (tenant?.primaryCurrency || 'EUR').toUpperCase();
    const rates = await this.currencyRates.getRates().catch(() => ({}) as Record<string, number>);
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
    return this.once('leads', async () => {
      let rows = excludeTrashedLeads(await this.svc.loadLeads(this.tenantId, this.loadFrom));
      if (this.scope.leadFilter) rows = rows.filter(this.scope.leadFilter);
      const f = this.filters;
      if (f.manager) rows = rows.filter((l) => l.assignedUserId === f.manager || (l.assignedUserIds || []).includes(f.manager!));
      if (f.channel) rows = rows.filter((l) => (l.source || 'unknown') === f.channel);
      return rows;
    });
  }

  private sales() {
    return this.once('sales', async (): Promise<SaleRow[]> => {
      const raw = await this.svc.loadSales(this.tenantId, this.loadFrom);
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
  private async revenueSales() {
    const rows = await this.sales();
    return rows.filter((r) => REVENUE_STATUSES.has(r.status) && (!this.scope.maskAmounts || r.own));
  }

  private calls() {
    return this.once('calls', async () => {
      let rows = await this.svc.loadCalls(this.tenantId, this.loadFrom);
      const me = this.scope.staff?.id;
      if (this.scope.ownOnly) rows = rows.filter((c) => !!me && c.staffUserId === me);
      if (this.filters.manager) rows = rows.filter((c) => c.staffUserId === this.filters.manager);
      return rows.map((c) => ({ t: (c.startedAt || c.createdAt).getTime(), status: c.status, direction: c.direction }));
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
      const [sales, res, hotels] = await Promise.all([
        this.svc.loadSales(this.tenantId, from),
        this.svc.loadReservations(this.tenantId, from),
        this.svc.loadHotelRevenue(this.tenantId, from),
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
        const delta = pctDelta(avg(cur), avg(prev));
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
    return { error: 'failed' };
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
      if ('rows' in low && low.rows.length) {
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
