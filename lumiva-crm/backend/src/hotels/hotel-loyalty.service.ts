import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { In, Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { HotelGuestProfile } from './hotel-guest-profile.entity';
import { HotelFolioLine } from './hotel-folio.entities';
import {
  HotelLoyaltyMember,
  HotelLoyaltyProgram,
  HotelLoyaltyStay,
  HotelLoyaltyTx,
  LoyaltyScope,
  LoyaltySettings,
  LoyaltyTier,
} from './hotel-loyalty.entities';
import { HotelFolioService, folioSummary } from './hotel-folio.service';
import { HotelReservationsService } from './hotel-reservations.service';
import { CurrencyRatesService } from '../currency/currency-rates.service';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';
import { tenantFrontend } from '../common/tenant-branding.util';
import { HotelBrand } from '../hotel-reputation/reputation.entities';

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (n: number) => Math.round(n * 100) / 100;
const bad = (code: string, message: string) => new BadRequestException({ code, message });
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DISCOUNT_MARK = '★ ';

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  points: { enabled: true, earnPerUnit: 1, includeExtras: false, pendingDays: 0, expiryMonths: 24, pointValue: 0.01, maxRedeemPct: 50 },
  tiers: [
    // стартовый уровень — без условий: у участника сразу есть уровень
    { key: 'silver', name: 'Silver', discountPct: 0, pointsMultiplier: 1, benefits: [] },
    { key: 'gold', name: 'Gold', minNights: 10, minStays: 3, discountPct: 5, pointsMultiplier: 1.25, benefits: [] },
    { key: 'platinum', name: 'Platinum', minNights: 25, minStays: 6, discountPct: 10, pointsMultiplier: 1.5, benefits: [] },
  ],
  tierPeriod: '12m',
  simpleDiscount: { enabled: false, fromStay: 2, pct: 5 },
  enrollment: 'auto_consent',
  partnerEarnPoints: false,
  partnerCountsForTier: true,
  settlement: { reimbursePct: 80, minTransfer: 50, monthlyRedeemCap: 0, imbalanceRatio: 3 },
  blackout: [],
};

/**
 * Лояльность: программа действует на отели, бренды (сеть) или весь аккаунт; отель — ровно в одной активной программе.
 * Начисление — по выезду (крон, раз на бронь), уровни — по ночам / проживаниям / сумме за 12 мес. или всё время,
 * баллы списываются оплатой счёта на стойке, скидка уровня — строкой фолио. Все суммы программы — в её валюте
 * (по курсу); отсюда взаиморасчёты сети: выдал баллы → должен пулу, принял → пул возмещает reimbursePct %.
 * Сообщения участникам — события для «Автоматизаций».
 */
@Injectable()
export class HotelLoyaltyService {
  private readonly log = new Logger(HotelLoyaltyService.name);

  constructor(
    @InjectRepository(HotelLoyaltyProgram) private readonly programs: Repository<HotelLoyaltyProgram>,
    @InjectRepository(HotelLoyaltyMember) private readonly members: Repository<HotelLoyaltyMember>,
    @InjectRepository(HotelLoyaltyTx) private readonly txs: Repository<HotelLoyaltyTx>,
    @InjectRepository(HotelLoyaltyStay) private readonly stays: Repository<HotelLoyaltyStay>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelReservation) private readonly reservations: Repository<HotelReservation>,
    @InjectRepository(HotelGuestProfile) private readonly profiles: Repository<HotelGuestProfile>,
    @InjectRepository(HotelFolioLine) private readonly lines: Repository<HotelFolioLine>,
    @InjectRepository(HotelBrand) private readonly brands: Repository<HotelBrand>,
    private readonly folio: HotelFolioService,
    private readonly reservationsService: HotelReservationsService,
    private readonly fx: CurrencyRatesService,
    private readonly automations: AutomationsService,
  ) {}

  // ─── программы ───

  private covers(p: HotelLoyaltyProgram, h: Pick<Hotel, 'id' | 'brandId'>) {
    if (p.scope === 'account') return true;
    if (p.scope === 'brands') return !!h.brandId && (p.brandIds || []).includes(h.brandId);
    return (p.hotelIds || []).includes(h.id);
  }

  async programForHotel(tenantId: string, hotelId: string) {
    const h = await this.hotels.findOne({ where: { id: hotelId, tenantId }, select: ['id', 'brandId'] as any });
    if (!h) return null;
    const list = await this.programs.find({ where: { tenantId, active: true }, order: { createdAt: 'ASC' } });
    return list.find((p) => this.covers(p, h)) || null;
  }

  private cleanSettings(s: Partial<LoyaltySettings> | undefined, base: LoyaltySettings): LoyaltySettings {
    const n = (v: unknown, def: number, min: number, max: number) => (v === undefined || v === null || v === '' ? def : Math.min(max, Math.max(min, num(v))));
    const pts = { ...base.points, ...(s?.points || {}) };
    const st = { ...base.settlement, ...(s?.settlement || {}) };
    const tiersIn = Array.isArray(s?.tiers) ? s!.tiers : base.tiers;
    const tiers: LoyaltyTier[] = tiersIn.slice(0, 8).map((t, i) => {
      const name = String(t?.name || '').trim().slice(0, 40);
      if (!name) throw bad('HOTEL_LOYALTY_TIER_NAME', 'У каждого уровня — название');
      const opt = (v: unknown) => (v === undefined || v === null || v === '' ? null : Math.max(0, num(v)));
      return {
        key: String(t?.key || name).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40) || `tier${i + 1}`,
        name, minNights: opt(t?.minNights), minStays: opt(t?.minStays), minSpend: opt(t?.minSpend),
        discountPct: n(t?.discountPct, 0, 0, 50), pointsMultiplier: n(t?.pointsMultiplier, 1, 0, 10),
        benefits: (Array.isArray(t?.benefits) ? t!.benefits : []).map((b) => String(b || '').trim().slice(0, 120)).filter(Boolean).slice(0, 10),
      };
    });
    const keys = new Set<string>();
    for (const t of tiers) { if (keys.has(t.key)) t.key = `${t.key}_${keys.size}`; keys.add(t.key); }
    const blackout = (Array.isArray(s?.blackout) ? s!.blackout : base.blackout)
      .filter((b) => b && ISO.test(String(b.from)) && ISO.test(String(b.to)) && b.from <= b.to)
      .slice(0, 50)
      .map((b) => ({ hotelId: b.hotelId || null, from: b.from, to: b.to }));
    const sd = { ...base.simpleDiscount, ...(s?.simpleDiscount || {}) };
    return {
      points: {
        enabled: !!pts.enabled, earnPerUnit: n(pts.earnPerUnit, 1, 0, 1000), includeExtras: !!pts.includeExtras, pendingDays: Math.round(n(pts.pendingDays, 0, 0, 90)),
        expiryMonths: Math.round(n(pts.expiryMonths, 24, 0, 120)), pointValue: n(pts.pointValue, 0.01, 0.0001, 100), maxRedeemPct: n(pts.maxRedeemPct, 50, 0, 100),
      },
      tiers,
      tierPeriod: s?.tierPeriod === 'lifetime' ? 'lifetime' : s?.tierPeriod === '12m' ? '12m' : base.tierPeriod,
      simpleDiscount: { enabled: !!sd.enabled, fromStay: Math.round(n(sd.fromStay, 2, 1, 100)), pct: n(sd.pct, 5, 0, 50) },
      enrollment: s?.enrollment === 'auto_all' || s?.enrollment === 'manual' || s?.enrollment === 'auto_consent' ? s.enrollment : base.enrollment,
      partnerEarnPoints: s?.partnerEarnPoints === undefined ? base.partnerEarnPoints : !!s.partnerEarnPoints,
      partnerCountsForTier: s?.partnerCountsForTier === undefined ? base.partnerCountsForTier : !!s.partnerCountsForTier,
      settlement: {
        reimbursePct: n(st.reimbursePct, 80, 0, 100), minTransfer: n(st.minTransfer, 0, 0, 1e9),
        monthlyRedeemCap: n(st.monthlyRedeemCap, 0, 0, 1e9), imbalanceRatio: n(st.imbalanceRatio, 3, 1, 100),
      },
      blackout,
    };
  }

  /** Один отель — одна активная программа: иначе непонятно, по какой копить и тратить */
  private async assertNoOverlap(tenantId: string, p: HotelLoyaltyProgram) {
    if (!p.active) return;
    const [all, hotels] = await Promise.all([
      this.programs.find({ where: { tenantId, active: true } }),
      this.hotels.find({ where: { tenantId }, select: ['id', 'name', 'brandId'] as any }),
    ]);
    const others = all.filter((x) => x.id !== p.id);
    const clash = hotels.filter((h) => this.covers(p, h) && others.some((o) => this.covers(o, h)));
    if (clash.length) throw bad('HOTEL_LOYALTY_OVERLAP', `Эти отели уже в другой программе: ${clash.map((h) => h.name).join(', ')}`);
  }

  async listPrograms(tenantId: string) {
    const [list, hotels, brands] = await Promise.all([
      this.programs.find({ where: { tenantId }, order: { createdAt: 'ASC' } }),
      this.hotels.find({ where: { tenantId }, select: ['id', 'name', 'brandId', 'currency'] as any, order: { name: 'ASC' } }),
      this.brands.find({ where: { tenantId }, order: { name: 'ASC' } }),
    ]);
    const counts: Array<{ programId: string; members: string; points: string }> = list.length
      ? await this.members.manager.query(`SELECT "programId", COUNT(*) AS members, COALESCE(SUM(points), 0) AS points FROM hotel_loyalty_members WHERE "tenantId" = $1 GROUP BY "programId"`, [tenantId])
      : [];
    return {
      programs: list.map((p) => {
        const c = counts.find((x) => x.programId === p.id);
        return { ...p, hotelsCovered: hotels.filter((h) => this.covers(p, h)).map((h) => h.id), members: Number(c?.members || 0), outstandingPoints: Number(c?.points || 0) };
      }),
      hotels: hotels.map((h) => ({ id: h.id, name: h.name, brandId: h.brandId, currency: (h.currency || '').toUpperCase() })),
      brands: brands.map((b) => ({ id: b.id, name: b.name })),
      defaults: DEFAULT_LOYALTY_SETTINGS,
    };
  }

  async saveProgram(tenantId: string, dto: { name?: string; scope?: string; hotelIds?: string[]; brandIds?: string[]; currency?: string; active?: boolean; settings?: Partial<LoyaltySettings> }, id?: string) {
    // новая программа — активна сразу (иначе проверка пересечений ниже пропустила бы её)
    const p = id ? await this.programs.findOne({ where: { id, tenantId } }) : this.programs.create({ tenantId, active: true, currency: 'EUR', hotelIds: [], brandIds: [], settings: DEFAULT_LOYALTY_SETTINGS });
    if (!p) throw new NotFoundException('Программа не найдена');
    if (dto.name !== undefined || !id) {
      const name = String(dto.name || '').trim().slice(0, 120);
      if (!name) throw bad('HOTEL_LOYALTY_NAME', 'Назовите программу');
      p.name = name;
    }
    if (dto.scope !== undefined) p.scope = (['hotels', 'brands', 'account'].includes(String(dto.scope)) ? dto.scope : 'hotels') as LoyaltyScope;
    const [hotels, brands] = await Promise.all([this.hotels.find({ where: { tenantId }, select: ['id'] as any }), this.brands.find({ where: { tenantId } })]);
    if (dto.hotelIds !== undefined) p.hotelIds = (dto.hotelIds || []).filter((x) => hotels.some((h) => h.id === x));
    if (dto.brandIds !== undefined) p.brandIds = (dto.brandIds || []).filter((x) => brands.some((b) => b.id === x));
    if (p.scope === 'hotels' && !p.hotelIds?.length) throw bad('HOTEL_LOYALTY_NO_HOTELS', 'Выберите отели программы');
    if (p.scope === 'brands' && !p.brandIds?.length) throw bad('HOTEL_LOYALTY_NO_BRANDS', 'Выберите бренды программы');
    if (dto.currency !== undefined) {
      const c = String(dto.currency || '').toUpperCase();
      if (!/^[A-Z]{3}$/.test(c)) throw bad('HOTEL_LOYALTY_CURRENCY', 'Валюта программы — код из 3 букв');
      if (id && c !== p.currency && (await this.txs.count({ where: { programId: p.id } }))) throw bad('HOTEL_LOYALTY_CURRENCY_LOCKED', 'Валюту программы нельзя менять после первых начислений');
      p.currency = c;
    }
    if (dto.active !== undefined) p.active = !!dto.active;
    if (dto.settings !== undefined || !id) p.settings = this.cleanSettings(dto.settings, p.settings || DEFAULT_LOYALTY_SETTINGS);
    await this.assertNoOverlap(tenantId, p);
    return this.programs.save(p);
  }

  // ─── участники ───

  private async newNumber(tenantId: string) {
    for (let i = 0; i < 10; i++) {
      const n = String(Math.floor(10_000_000 + Math.random() * 89_999_999));
      if (!(await this.members.count({ where: { tenantId, number: n } }))) return n;
    }
    return String(Date.now()).slice(-10);
  }

  private async ensureMember(p: HotelLoyaltyProgram, profileId: string) {
    const ex = await this.members.findOne({ where: { programId: p.id, profileId } });
    if (ex) return { member: ex, created: false };
    const member = await this.members.save(this.members.create({
      tenantId: p.tenantId, programId: p.id, profileId, number: await this.newNumber(p.tenantId), token: randomBytes(18).toString('hex'),
      tier: null, points: 0, pendingPoints: 0, lifetimePoints: 0, status: 'active', lastActivityAt: new Date(),
    }));
    return { member, created: true };
  }

  async enroll(tenantId: string, programId: string, profileId: string) {
    const p = await this.programs.findOne({ where: { id: programId, tenantId } });
    if (!p) throw new NotFoundException('Программа не найдена');
    const prof = await this.profiles.findOne({ where: { id: profileId, tenantId } });
    if (!prof || prof.anonymizedAt) throw new NotFoundException('Профиль гостя не найден');
    const { member, created } = await this.ensureMember(p, profileId);
    if (created) {
      await this.recomputeTier(p, member, false);
      void this.emit(p, member, TriggerEvent.HOTEL_LOYALTY_JOINED, {});
    }
    return member;
  }

  private async periodStats(p: HotelLoyaltyProgram, memberId: string) {
    const since = p.settings.tierPeriod === 'lifetime' ? '1900-01-01' : new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
    const [row] = await this.stays.manager.query(
      `SELECT COUNT(*)::int AS stays, COALESCE(SUM(nights), 0)::int AS nights, COALESCE(SUM(spend), 0)::numeric AS spend
         FROM hotel_loyalty_stays WHERE "memberId" = $1 AND "countsForTier" = true AND "checkOut" >= $2`,
      [memberId, since],
    );
    return { stays: Number(row?.stays || 0), nights: Number(row?.nights || 0), spend: r2(num(row?.spend)) };
  }

  private tierFor(p: HotelLoyaltyProgram, s: { stays: number; nights: number; spend: number }) {
    let found: LoyaltyTier | null = null;
    for (const t of p.settings.tiers) {
      const checks = [t.minNights ? s.nights >= t.minNights : null, t.minStays ? s.stays >= t.minStays : null, t.minSpend ? s.spend >= t.minSpend : null].filter((x) => x !== null);
      // уровень без порогов — стартовый (у всех участников)
      if (!checks.length || checks.some(Boolean)) found = t;
    }
    return found;
  }

  private async recomputeTier(p: HotelLoyaltyProgram, m: HotelLoyaltyMember, notify = true) {
    const s = await this.periodStats(p, m.id);
    const t = this.tierFor(p, s);
    const next = t?.key ?? null;
    if (next === m.tier) return m;
    const order = p.settings.tiers.map((x) => x.key);
    const up = next !== null && (m.tier === null || order.indexOf(next) > order.indexOf(m.tier));
    m.tier = next;
    m.tierSince = new Date();
    await this.members.update({ id: m.id }, { tier: m.tier, tierSince: m.tierSince });
    if (up && notify) void this.emit(p, m, TriggerEvent.HOTEL_LOYALTY_TIER_UP, {});
    return m;
  }

  // ─── начисление по выезду ───

  private isPartner(r: HotelReservation) {
    return !!r.agencyId && r.accommodationFolio === 'partner';
  }

  /** Крон: выехавшие гости → проживание учтено, баллы начислены (раз на бронь), уровень пересчитан */
  async processCheckouts() {
    const progs = await this.programs.find({ where: { active: true } });
    if (!progs.length) return 0;
    let n = 0;
    const rows: HotelReservation[] = await this.reservations
      .createQueryBuilder('r')
      .where('r.status = :st', { st: 'checked_out' })
      .andWhere('r.guestProfileId IS NOT NULL')
      .andWhere('r.tenantId IN (:...t)', { t: [...new Set(progs.map((p) => p.tenantId))] })
      .andWhere(`NOT EXISTS (SELECT 1 FROM hotel_loyalty_stays s WHERE s."reservationId" = r.id)`)
      .andWhere(`r."checkOut" >= (now() - interval '400 days')::date`)
      .orderBy('r.checkOut', 'ASC')
      .take(300)
      .getMany();
    const hotelCache = new Map<string, Hotel | null>();
    for (const r of rows) {
      try {
        if (!hotelCache.has(r.hotelId)) hotelCache.set(r.hotelId, await this.hotels.findOne({ where: { id: r.hotelId } }));
        const h = hotelCache.get(r.hotelId);
        if (!h) continue;
        const p = progs.find((x) => x.tenantId === r.tenantId && this.covers(x, h));
        // проживания до запуска программы не начисляем (иначе внезапный долг сети); выезд — не раньше дня создания
        if (!p || r.checkOut < p.createdAt.toISOString().slice(0, 10)) continue;
        if (await this.processStay(p, r, h)) n++;
      } catch (e) {
        this.log.warn(`loyalty stay ${r.id}: ${(e as Error).message}`);
      }
    }
    return n;
  }

  private async processStay(p: HotelLoyaltyProgram, r: HotelReservation, h: Hotel) {
    const prof = await this.profiles.findOne({ where: { id: r.guestProfileId!, tenantId: r.tenantId } });
    if (!prof || prof.anonymizedAt || prof.blacklisted) return false;
    let member = await this.members.findOne({ where: { programId: p.id, profileId: prof.id } });
    let joined = false;
    if (!member) {
      const may = p.settings.enrollment === 'auto_all' || (p.settings.enrollment === 'auto_consent' && prof.marketingConsent);
      if (!may) return false;
      const x = await this.ensureMember(p, prof.id);
      member = x.member;
      joined = x.created;
    }
    if (member.status !== 'active') return false;
    const partner = this.isPartner(r);
    const lines = await this.lines.find({ where: { tenantId: r.tenantId, reservationId: r.id } });
    const s = folioSummary(r, lines, h);
    // сумма гостя: проживание (если в гостевом счёте) + доп. услуги гостя (если программа их учитывает)
    const accGuest = s.accommodationFolio === 'guest' ? s.accommodation : 0;
    const spendHotel = r2(accGuest + (p.settings.points.includeExtras ? s.folios.guest.extras : 0));
    const spend = r2(await this.fx.convert(spendHotel, (h.currency || p.currency).toUpperCase(), p.currency));
    const nights = Math.max(1, Math.round((Date.parse(`${r.checkOut}T00:00:00Z`) - Date.parse(`${r.checkIn}T00:00:00Z`)) / 86_400_000));
    const tier = p.settings.tiers.find((t) => t.key === member!.tier);
    const earn = p.settings.points.enabled && (!partner || p.settings.partnerEarnPoints)
      ? Math.floor(spend * p.settings.points.earnPerUnit * (tier?.pointsMultiplier ?? 1))
      : 0;
    // учёт проживания — уникальный по брони: повтор крона ничего не задвоит
    const ins: Array<{ id: string }> = await this.stays.manager.query(
      `INSERT INTO hotel_loyalty_stays ("tenantId", "programId", "memberId", "hotelId", "reservationId", "checkOut", nights, spend, "countsForTier", points)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT ("reservationId") DO NOTHING RETURNING id`,
      [r.tenantId, p.id, member.id, h.id, r.id, r.checkOut, nights, spend, !partner || p.settings.partnerCountsForTier, earn],
    );
    if (!ins.length) return false;
    if (earn > 0) {
      const pending = p.settings.points.pendingDays > 0;
      await this.txs.save(this.txs.create({
        tenantId: r.tenantId, programId: p.id, memberId: member.id, hotelId: h.id, reservationId: r.id, type: 'earn', points: earn,
        value: String(r2(earn * p.settings.points.pointValue)), status: pending ? 'pending' : 'posted',
        availableAt: pending ? new Date(Date.now() + p.settings.points.pendingDays * 86_400_000) : null, note: r.bookingCode || null,
      }));
      await this.members.manager.query(
        `UPDATE hotel_loyalty_members SET ${pending ? '"pendingPoints" = "pendingPoints" + $2' : 'points = points + $2'}, "lifetimePoints" = "lifetimePoints" + $2, "lastActivityAt" = now(), "expiryWarnedAt" = NULL, "updatedAt" = now() WHERE id = $1`,
        [member.id, earn],
      );
    } else {
      await this.members.update({ id: member.id }, { lastActivityAt: new Date() });
    }
    const fresh = (await this.members.findOne({ where: { id: member.id } }))!;
    await this.recomputeTier(p, fresh);
    if (joined) void this.emit(p, fresh, TriggerEvent.HOTEL_LOYALTY_JOINED, {}, r);
    if (earn > 0 && !p.settings.points.pendingDays) void this.emit(p, fresh, TriggerEvent.HOTEL_LOYALTY_POINTS_EARNED, { points_earned: String(earn) }, r);
    return true;
  }

  /** Крон: «в ожидании» → доступны; сгорание при неактивности (с предупреждением за 30 дней) */
  async postPendingAndExpire() {
    const due = await this.txs.find({ where: { status: 'pending' }, take: 500 });
    for (const t of due.filter((x) => x.availableAt && x.availableAt.getTime() <= Date.now())) {
      const r = await this.txs.update({ id: t.id, status: 'pending' }, { status: 'posted' });
      if (!r.affected) continue;
      await this.members.manager.query(`UPDATE hotel_loyalty_members SET "pendingPoints" = GREATEST(0, "pendingPoints" - $2), points = points + $2, "updatedAt" = now() WHERE id = $1`, [t.memberId, t.points]);
      const [p, m] = await Promise.all([this.programs.findOne({ where: { id: t.programId } }), this.members.findOne({ where: { id: t.memberId } })]);
      const res = t.reservationId ? await this.reservations.findOne({ where: { id: t.reservationId } }) : null;
      if (p && m) void this.emit(p, m, TriggerEvent.HOTEL_LOYALTY_POINTS_EARNED, { points_earned: String(t.points) }, res);
    }
    const progs = await this.programs.find({ where: { active: true } });
    for (const p of progs.filter((x) => x.settings.points.expiryMonths > 0)) {
      const months = p.settings.points.expiryMonths;
      const cutoff = new Date(Date.now() - months * 30.44 * 86_400_000);
      const warnCut = new Date(cutoff.getTime() + 30 * 86_400_000);
      const warn = await this.members.createQueryBuilder('m')
        .where('m.programId = :p AND m.points > 0 AND m.expiryWarnedAt IS NULL AND m.lastActivityAt < :w AND m.lastActivityAt >= :c', { p: p.id, w: warnCut, c: cutoff })
        .take(500).getMany();
      for (const m of warn) {
        await this.members.update({ id: m.id }, { expiryWarnedAt: new Date() });
        const exp = new Date(m.lastActivityAt!.getTime() + months * 30.44 * 86_400_000).toISOString().slice(0, 10);
        void this.emit(p, m, TriggerEvent.HOTEL_LOYALTY_POINTS_EXPIRING, { expire_date: exp });
      }
      const gone = await this.members.createQueryBuilder('m').where('m.programId = :p AND m.points > 0 AND m.lastActivityAt < :c', { p: p.id, c: cutoff }).take(500).getMany();
      for (const m of gone) {
        await this.txs.save(this.txs.create({ tenantId: m.tenantId, programId: p.id, memberId: m.id, type: 'expire', points: -m.points, value: String(r2(-m.points * p.settings.points.pointValue)), status: 'posted', note: `${months} мес. без активности` }));
        await this.members.update({ id: m.id }, { points: 0 });
      }
    }
  }

  // ─── стойка: карточка участника, скидка, оплата баллами ───

  private async hotelValue(p: HotelLoyaltyProgram, h: Hotel, points: number) {
    return r2(await this.fx.convert(points * p.settings.points.pointValue, p.currency, (h.currency || p.currency).toUpperCase()));
  }

  async card(tenantId: string, reservationId: string) {
    const r = await this.reservations.findOne({ where: { id: reservationId, tenantId } });
    if (!r) throw new NotFoundException('Бронь не найдена');
    const p = await this.programForHotel(tenantId, r.hotelId);
    if (!p) return { program: null };
    const h = (await this.hotels.findOne({ where: { id: r.hotelId, tenantId } }))!;
    const member = r.guestProfileId ? await this.members.findOne({ where: { programId: p.id, profileId: r.guestProfileId } }) : null;
    const base = { program: { id: p.id, name: p.name, currency: p.currency, pointValue: p.settings.points.pointValue, pointsEnabled: p.settings.points.enabled }, profileId: r.guestProfileId, hotelCurrency: (h.currency || '').toUpperCase() };
    if (!member) return { ...base, member: null, canEnroll: !!r.guestProfileId };
    const stats = await this.periodStats(p, member.id);
    const tiers = p.settings.tiers;
    const idx = tiers.findIndex((t) => t.key === member.tier);
    const tier = idx >= 0 ? tiers[idx] : null;
    const next = tiers[idx + 1] || null;
    const lines = await this.lines.find({ where: { tenantId, reservationId: r.id } });
    const s = folioSummary(r, lines, h);
    const redeemed = await this.txs.find({ where: { tenantId, reservationId: r.id, type: 'redeem', status: 'posted' }, order: { createdAt: 'ASC' } });
    const reversed = new Set((await this.txs.find({ where: { tenantId, reservationId: r.id, type: 'reverse' } })).map((x) => x.paymentId));
    const activeRedeems = redeemed.filter((x) => !reversed.has(x.paymentId));
    const paidByPoints = (r.payments || []).filter((x) => x.method === 'points').reduce((x, y) => x + num(y.amount), 0);
    const capHotel = r2((s.folios.guest.charges * p.settings.points.maxRedeemPct) / 100 - paidByPoints);
    const pointHotel = (await this.hotelValue(p, h, 1)) || 0.000001;
    const maxByCap = Math.max(0, Math.floor(Math.min(capHotel, s.folios.guest.balance) / pointHotel + 1e-9));
    const discountPct = this.discountPctFor(p, tier, stats.stays);
    const discountApplied = lines.some((l) => !l.voided && !l.voidOfId && l.kind === 'discount' && l.description.startsWith(DISCOUNT_MARK));
    return {
      ...base,
      member: {
        id: member.id, number: member.number, status: member.status, tier: tier ? { key: tier.key, name: tier.name, discountPct: tier.discountPct || 0, benefits: tier.benefits || [] } : null,
        points: member.points, pendingPoints: member.pendingPoints, pointsValueHotel: await this.hotelValue(p, h, member.points), stats,
        next: next ? { name: next.name, minNights: next.minNights ?? null, minStays: next.minStays ?? null, minSpend: next.minSpend ?? null } : null,
      },
      partner: this.isPartner(r),
      blackout: this.blackoutHit(p, h.id, r.checkIn, r.checkOut),
      maxRedeemPoints: p.settings.points.enabled ? Math.min(member.points, maxByCap) : 0,
      discountPct, discountApplied,
      redemptions: activeRedeems.map((t) => ({ id: t.id, points: -t.points, value: num(t.value), createdAt: t.createdAt })),
    };
  }

  /** Скидка участника: уровень или простой режим «с N-го проживания» (берётся бо́льшая) */
  private discountPctFor(p: HotelLoyaltyProgram, tier: LoyaltyTier | null | undefined, staysSoFar: number) {
    const fromTier = tier?.discountPct || 0;
    const sd = p.settings.simpleDiscount;
    const fromSimple = sd.enabled && staysSoFar + 1 >= sd.fromStay ? sd.pct : 0;
    return Math.max(fromTier, fromSimple);
  }

  private blackoutHit(p: HotelLoyaltyProgram, hotelId: string, from: string, to: string) {
    return (p.settings.blackout || []).some((b) => (!b.hotelId || b.hotelId === hotelId) && b.from < to && b.to >= from);
  }

  /** Скидка участника на проживание — строкой «скидка» в гостевом счёте (только прямые брони, раз на бронь) */
  async applyDiscount(tenantId: string, reservationId: string, actor: string | null) {
    const c = await this.card(tenantId, reservationId);
    if (!c.program || !('member' in c) || !c.member) throw bad('HOTEL_LOYALTY_NOT_MEMBER', 'Гость не участник программы');
    if (c.partner) throw bad('HOTEL_LOYALTY_PARTNER', 'Скидка участника — только для прямых броней');
    if (c.discountApplied) throw bad('HOTEL_LOYALTY_DISCOUNT_DONE', 'Скидка участника уже в счёте');
    if (!(c.discountPct > 0)) throw bad('HOTEL_LOYALTY_NO_DISCOUNT', 'У уровня гостя нет скидки');
    const r = (await this.reservations.findOne({ where: { id: reservationId, tenantId } }))!;
    if (['cancelled', 'no_show', 'checked_out'].includes(r.status)) throw bad('HOTEL_LOYALTY_CLOSED', 'Бронь закрыта');
    const h = (await this.hotels.findOne({ where: { id: r.hotelId, tenantId } }))!;
    const lines = await this.lines.find({ where: { tenantId, reservationId } });
    const acc = folioSummary(r, lines, h).accommodation;
    const amount = r2((acc * c.discountPct) / 100);
    if (!(amount > 0)) throw bad('HOTEL_LOYALTY_NO_DISCOUNT', 'Нечего скидывать');
    const label = c.member.tier ? `${c.member.tier.name} −${c.discountPct}%` : `−${c.discountPct}%`;
    return this.folio.postLine(tenantId, reservationId, { kind: 'discount', description: `${DISCOUNT_MARK}${c.program.name}: ${label}`, quantity: 1, unitPrice: amount, folio: 'guest' } as any, actor);
  }

  /** Оплата счёта баллами: платёж «баллы» в брони (мимо кассы) + списание с участника; лимиты программы */
  async redeem(tenantId: string, reservationId: string, pointsIn: number, actor: string | null) {
    const points = Math.floor(num(pointsIn));
    if (!(points > 0)) throw bad('HOTEL_LOYALTY_POINTS', 'Укажите, сколько баллов списать');
    const c = await this.card(tenantId, reservationId);
    if (!c.program || !('member' in c) || !c.member) throw bad('HOTEL_LOYALTY_NOT_MEMBER', 'Гость не участник программы');
    if (!c.program.pointsEnabled) throw bad('HOTEL_LOYALTY_POINTS_OFF', 'В программе нет баллов');
    if (c.member.status !== 'active') throw bad('HOTEL_LOYALTY_BLOCKED', 'Участник заблокирован');
    if (c.blackout) throw bad('HOTEL_LOYALTY_BLACKOUT', 'В эти даты отель не принимает баллы');
    if (points > c.member.points) throw bad('HOTEL_LOYALTY_BALANCE', `На счёте только ${c.member.points} баллов`);
    if (points > c.maxRedeemPoints) throw bad('HOTEL_LOYALTY_MAX', `Сейчас можно списать не больше ${c.maxRedeemPoints} баллов (лимит программы и остаток счёта)`);
    const r = (await this.reservations.findOne({ where: { id: reservationId, tenantId } }))!;
    if (['cancelled', 'no_show'].includes(r.status)) throw bad('HOTEL_LOYALTY_CLOSED', 'Бронь закрыта');
    const p = (await this.programs.findOne({ where: { id: c.program.id } }))!;
    const h = (await this.hotels.findOne({ where: { id: r.hotelId, tenantId } }))!;
    const value = r2(points * p.settings.points.pointValue);
    if (p.settings.settlement.monthlyRedeemCap > 0) {
      const [row] = await this.txs.manager.query(
        `SELECT COALESCE(SUM(value), 0) AS v FROM hotel_loyalty_tx WHERE "programId" = $1 AND "hotelId" = $2 AND type = 'redeem' AND status = 'posted' AND "createdAt" >= date_trunc('month', now())`,
        [p.id, h.id],
      );
      const rev: Array<{ v: string }> = await this.txs.manager.query(
        `SELECT COALESCE(SUM(-value), 0) AS v FROM hotel_loyalty_tx WHERE "programId" = $1 AND "hotelId" = $2 AND type = 'reverse' AND "createdAt" >= date_trunc('month', now())`,
        [p.id, h.id],
      );
      if (num(row?.v) - num(rev[0]?.v) + value > p.settings.settlement.monthlyRedeemCap + 0.009) throw bad('HOTEL_LOYALTY_HOTEL_CAP', 'Отель исчерпал месячный лимит приёма баллов');
    }
    // списываем атомарно: баланс не уйдёт в минус при двух одновременных списаниях
    const upd = await this.members.manager.query(`UPDATE hotel_loyalty_members SET points = points - $2, "lastActivityAt" = now(), "expiryWarnedAt" = NULL, "updatedAt" = now() WHERE id = $1 AND points >= $2 RETURNING id`, [c.member.id, points]);
    const updRows = Array.isArray(upd?.[0]) ? upd[0] : upd;
    if (!updRows?.length) throw bad('HOTEL_LOYALTY_BALANCE', 'Баланс изменился — обновите карточку');
    const amountHotel = await this.hotelValue(p, h, points);
    let saved: HotelReservation;
    try {
      saved = await this.reservationsService.addPayment(tenantId, reservationId, { amount: String(amountHotel), method: 'points', folio: 'guest', note: `${p.name}: ${points} баллов · №${c.member.number}` }, actor);
    } catch (e) {
      await this.members.manager.query(`UPDATE hotel_loyalty_members SET points = points + $2 WHERE id = $1`, [c.member.id, points]);
      throw e;
    }
    const pay = [...(saved.payments || [])].reverse().find((x) => x.method === 'points');
    return this.txs.save(this.txs.create({ tenantId, programId: p.id, memberId: c.member.id, hotelId: h.id, reservationId, type: 'redeem', points: -points, value: String(value), status: 'posted', paymentId: pay?.id ?? null, createdBy: actor, note: r.bookingCode || null }));
  }

  /** Отмена оплаты баллами: платёж убирается из брони, баллы возвращаются (движение «возврат» — минус для взаиморасчётов) */
  async cancelRedeem(tenantId: string, txId: string, actor: string | null) {
    const t = await this.txs.findOne({ where: { id: txId, tenantId, type: 'redeem' } });
    if (!t || !t.reservationId || !t.paymentId) throw new NotFoundException('Списание не найдено');
    if (await this.txs.count({ where: { tenantId, type: 'reverse', paymentId: t.paymentId } })) throw bad('HOTEL_LOYALTY_REVERSED', 'Списание уже отменено');
    await this.reservationsService.removePayment(tenantId, t.reservationId, t.paymentId, actor);
    await this.members.manager.query(`UPDATE hotel_loyalty_members SET points = points + $2, "updatedAt" = now() WHERE id = $1`, [t.memberId, -t.points]);
    return this.txs.save(this.txs.create({ tenantId, programId: t.programId, memberId: t.memberId, hotelId: t.hotelId, reservationId: t.reservationId, type: 'reverse', points: -t.points, value: String(-num(t.value)), status: 'posted', paymentId: t.paymentId, createdBy: actor, note: 'Отмена оплаты баллами' }));
  }

  // ─── участники: список, карточка, корректировка ───

  async listMembers(tenantId: string, q: { programId?: string; search?: string; tier?: string; page?: number }) {
    const qb = this.members.createQueryBuilder('m')
      .innerJoin(HotelGuestProfile, 'g', 'g.id = m.profileId')
      .select(['m.id AS id', 'm.number AS number', 'm.tier AS tier', 'm.points AS points', 'm."pendingPoints" AS "pendingPoints"', 'm."lifetimePoints" AS "lifetimePoints"', 'm.status AS status', 'm."programId" AS "programId"', 'm."joinedAt" AS "joinedAt"', 'm."lastActivityAt" AS "lastActivityAt"', 'g.id AS "profileId"', 'g."fullName" AS "fullName"', 'g.email AS email', 'g.country AS country', 'g.vip AS vip'])
      .where('m.tenantId = :t', { t: tenantId });
    if (q.programId) qb.andWhere('m.programId = :p', { p: q.programId });
    if (q.tier) qb.andWhere('m.tier = :tier', { tier: q.tier });
    if (q.search) qb.andWhere(`(g."fullName" ILIKE :s OR g.email ILIKE :s OR m.number LIKE :s2)`, { s: `%${q.search.trim()}%`, s2: `%${q.search.trim()}%` });
    const page = Math.max(1, Math.round(num(q.page) || 1));
    const total = await qb.getCount();
    const rows = await qb.orderBy('m.points', 'DESC').offset((page - 1) * 50).limit(50).getRawMany();
    return { total, page, items: rows.map((x) => ({ ...x, points: Number(x.points), pendingPoints: Number(x.pendingPoints), lifetimePoints: Number(x.lifetimePoints) })) };
  }

  async memberDetail(tenantId: string, id: string) {
    const m = await this.members.findOne({ where: { id, tenantId } });
    if (!m) throw new NotFoundException('Участник не найден');
    const [p, prof, tx, st] = await Promise.all([
      this.programs.findOne({ where: { id: m.programId } }),
      this.profiles.findOne({ where: { id: m.profileId } }),
      this.txs.find({ where: { memberId: m.id }, order: { createdAt: 'DESC' }, take: 200 }),
      this.stays.find({ where: { memberId: m.id }, order: { checkOut: 'DESC' }, take: 100 }),
    ]);
    const hotelIds = [...new Set([...tx.map((x) => x.hotelId), ...st.map((x) => x.hotelId)].filter(Boolean))] as string[];
    const hotels = hotelIds.length ? await this.hotels.find({ where: { id: In(hotelIds) }, select: ['id', 'name'] as any }) : [];
    const name = (hid: string | null) => hotels.find((h) => h.id === hid)?.name || '';
    const stats = p ? await this.periodStats(p, m.id) : null;
    return {
      member: m, program: p ? { id: p.id, name: p.name, currency: p.currency, tiers: p.settings.tiers, tierPeriod: p.settings.tierPeriod, pointValue: p.settings.points.pointValue } : null,
      profile: prof ? { id: prof.id, fullName: prof.fullName, email: prof.email, phone: prof.phone, country: prof.country, vip: prof.vip, marketingConsent: prof.marketingConsent } : null,
      stats, link: `${await tenantFrontend((sql, params) => this.members.manager.query(sql, params), tenantId)}/lp/${m.token}`,
      tx: tx.map((x) => ({ ...x, value: num(x.value), hotelName: name(x.hotelId) })),
      stays: st.map((x) => ({ ...x, spend: num(x.spend), hotelName: name(x.hotelId) })),
    };
  }

  async adjust(tenantId: string, id: string, dto: { points?: number; note?: string; hotelId?: string | null }, actor: string | null) {
    const m = await this.members.findOne({ where: { id, tenantId } });
    if (!m) throw new NotFoundException('Участник не найден');
    const points = Math.round(num(dto.points));
    if (!points) throw bad('HOTEL_LOYALTY_POINTS', 'Укажите, сколько баллов начислить или списать');
    const note = String(dto.note || '').trim().slice(0, 500);
    if (!note) throw bad('HOTEL_LOYALTY_REASON', 'Укажите причину корректировки');
    if (m.points + points < 0) throw bad('HOTEL_LOYALTY_BALANCE', `На счёте только ${m.points} баллов`);
    const p = (await this.programs.findOne({ where: { id: m.programId } }))!;
    const hotelId = dto.hotelId && (await this.hotels.count({ where: { id: dto.hotelId, tenantId } })) ? dto.hotelId : null;
    await this.members.manager.query(`UPDATE hotel_loyalty_members SET points = points + $2, "lifetimePoints" = "lifetimePoints" + GREATEST($2, 0), "lastActivityAt" = now(), "updatedAt" = now() WHERE id = $1`, [m.id, points]);
    return this.txs.save(this.txs.create({ tenantId, programId: p.id, memberId: m.id, hotelId, type: 'adjust', points, value: String(r2(points * p.settings.points.pointValue)), status: 'posted', note, createdBy: actor }));
  }

  async setStatus(tenantId: string, id: string, status: string) {
    const m = await this.members.findOne({ where: { id, tenantId } });
    if (!m) throw new NotFoundException('Участник не найден');
    m.status = status === 'blocked' ? 'blocked' : 'active';
    return this.members.save(m);
  }

  // ─── взаиморасчёты сети ───

  /**
   * За период, в валюте программы: отель выдал баллы (earn + ручные начисления с отелем) — должен пулу их стоимость;
   * принял баллы оплатой (redeem − отмены) — пул возмещает reimbursePct %. Сальдо отеля = возмещение − выдано.
   * Переводы — минимальным числом пар «плательщик → получатель»; суммы меньше minTransfer переносятся.
   * Разница в пользу пула (баллы выданы, но не потрачены / сгорели) — резерв программы (обязательства перед гостями).
   */
  async settlement(tenantId: string, programId: string, from: string, to: string) {
    if (!ISO.test(from) || !ISO.test(to) || to < from) throw bad('HOTEL_LOYALTY_DATES', 'Неверный период');
    const p = await this.programs.findOne({ where: { id: programId, tenantId } });
    if (!p) throw new NotFoundException('Программа не найдена');
    const rows: Array<{ hotelId: string; type: string; points: string; value: string }> = await this.txs.manager.query(
      `SELECT "hotelId", type, SUM(points) AS points, SUM(value) AS value FROM hotel_loyalty_tx
        WHERE "programId" = $1 AND status = 'posted' AND "hotelId" IS NOT NULL AND "createdAt" >= $2::date AND "createdAt" < ($3::date + 1)
        GROUP BY "hotelId", type`,
      [p.id, from, to],
    );
    const hotels = await this.hotels.find({ where: { tenantId }, select: ['id', 'name', 'brandId'] as any });
    const rp = p.settings.settlement.reimbursePct / 100;
    const ids = [...new Set([...rows.map((x) => x.hotelId), ...hotels.filter((h) => this.covers(p, h)).map((h) => h.id)])];
    const per = ids.map((hid) => {
      const by = (t: string) => rows.filter((x) => x.hotelId === hid && x.type === t);
      const sum = (list: typeof rows, k: 'points' | 'value') => list.reduce((s, x) => s + num(x[k]), 0);
      const adjustPos = rows.filter((x) => x.hotelId === hid && x.type === 'adjust' && num(x.points) > 0);
      const issuedPoints = sum(by('earn'), 'points') + sum(adjustPos, 'points');
      const issued = r2(sum(by('earn'), 'value') + sum(adjustPos, 'value'));
      const redeemedPoints = -sum(by('redeem'), 'points') - sum(by('reverse'), 'points');
      const redeemedValue = r2(sum(by('redeem'), 'value') + sum(by('reverse'), 'value'));
      const reimbursed = r2(redeemedValue * rp);
      const net = r2(reimbursed - issued);
      const ratio = issued > 0 ? r2(redeemedValue / issued) : redeemedValue > 0 ? null : 0;
      return {
        hotelId: hid, hotelName: hotels.find((h) => h.id === hid)?.name || '—', issuedPoints, issued, redeemedPoints, redeemedValue, reimbursed, net,
        imbalance: redeemedValue > 0 && (ratio === null || ratio >= p.settings.settlement.imbalanceRatio),
        ratio,
      };
    });
    // переводы: должники (net < 0) платят получателям (net > 0) — жадно, крупные с крупными; пул закрывает остаток
    const payers = per.filter((x) => x.net < 0).map((x) => ({ id: x.hotelId, name: x.hotelName, left: -x.net })).sort((a, b) => b.left - a.left);
    const receivers = per.filter((x) => x.net > 0).map((x) => ({ id: x.hotelId, name: x.hotelName, left: x.net })).sort((a, b) => b.left - a.left);
    const transfers: Array<{ from: string; fromName: string; to: string; toName: string; amount: number }> = [];
    const carried: Array<{ from: string; fromName: string; to: string; toName: string; amount: number }> = [];
    for (const rcv of receivers) {
      for (const pay of payers) {
        if (rcv.left <= 0.004) break;
        if (pay.left <= 0.004) continue;
        const amt = r2(Math.min(rcv.left, pay.left));
        rcv.left = r2(rcv.left - amt);
        pay.left = r2(pay.left - amt);
        (amt >= p.settings.settlement.minTransfer ? transfers : carried).push({ from: pay.id, fromName: pay.name, to: rcv.id, toName: rcv.name, amount: amt });
      }
    }
    const totalIssued = r2(per.reduce((s, x) => s + x.issued, 0));
    const totalReimbursed = r2(per.reduce((s, x) => s + x.reimbursed, 0));
    const [liab] = await this.members.manager.query(`SELECT COALESCE(SUM(points), 0) AS p, COALESCE(SUM("pendingPoints"), 0) AS pp FROM hotel_loyalty_members WHERE "programId" = $1`, [p.id]);
    return {
      program: { id: p.id, name: p.name, currency: p.currency, reimbursePct: p.settings.settlement.reimbursePct, minTransfer: p.settings.settlement.minTransfer, imbalanceRatio: p.settings.settlement.imbalanceRatio },
      from, to, hotels: per.sort((a, b) => a.net - b.net), transfers, carried,
      pool: { issued: totalIssued, reimbursed: totalReimbursed, retained: r2(totalIssued - totalReimbursed) },
      liability: { points: Number(liab?.p || 0), pendingPoints: Number(liab?.pp || 0), value: r2((Number(liab?.p || 0) + Number(liab?.pp || 0)) * p.settings.points.pointValue) },
    };
  }

  // ─── страница участника /lp/:token ───

  async publicGet(token: string) {
    const m = /^[a-f0-9]{36}$/.test(String(token || '')) ? await this.members.findOne({ where: { token } }) : null;
    if (!m) throw new NotFoundException('Карта не найдена');
    const [p, prof] = await Promise.all([this.programs.findOne({ where: { id: m.programId } }), this.profiles.findOne({ where: { id: m.profileId } })]);
    if (!p || !prof) throw new NotFoundException('Карта не найдена');
    const stats = await this.periodStats(p, m.id);
    const idx = p.settings.tiers.findIndex((t) => t.key === m.tier);
    const tx = await this.txs.find({ where: { memberId: m.id, status: In(['posted', 'pending']) }, order: { createdAt: 'DESC' }, take: 15 });
    const hotels = await this.hotels.find({ where: { tenantId: m.tenantId }, select: ['id', 'name', 'brandId'] as any });
    return {
      program: p.name, currency: p.currency, pointValue: p.settings.points.pointValue, pointsEnabled: p.settings.points.enabled,
      hotels: hotels.filter((h) => this.covers(p, h)).map((h) => h.name),
      guestFirstName: String(prof.fullName || '').trim().split(/\s+/)[0] || '', number: m.number, points: m.points, pendingPoints: m.pendingPoints,
      tier: idx >= 0 ? { name: p.settings.tiers[idx].name, discountPct: p.settings.tiers[idx].discountPct || 0, benefits: p.settings.tiers[idx].benefits || [] } : null,
      next: p.settings.tiers[idx + 1] ? { name: p.settings.tiers[idx + 1].name, minNights: p.settings.tiers[idx + 1].minNights ?? null, minStays: p.settings.tiers[idx + 1].minStays ?? null, minSpend: p.settings.tiers[idx + 1].minSpend ?? null } : null,
      stats, tierPeriod: p.settings.tierPeriod, lang: HotelReservationsService.guestLang(prof.country),
      history: tx.map((x) => ({ type: x.type, points: x.points, status: x.status, date: x.createdAt, hotel: hotels.find((h) => h.id === x.hotelId)?.name || '' })),
    };
  }

  // ─── события для «Автоматизаций» ───

  private async emit(p: HotelLoyaltyProgram, m: HotelLoyaltyMember, event: TriggerEvent, extra: Record<string, string>, r?: HotelReservation | null) {
    try {
      const prof = await this.profiles.findOne({ where: { id: m.profileId } });
      if (!prof) return;
      const fresh = (await this.members.findOne({ where: { id: m.id } })) || m;
      const tier = p.settings.tiers.find((t) => t.key === fresh.tier);
      const base = await tenantFrontend((sql, params) => this.members.manager.query(sql, params), p.tenantId);
      const lang = (prof.language || '').slice(0, 2) || HotelReservationsService.guestLang(prof.country);
      await this.automations.triggerAutomation(p.tenantId, event, {
        entityType: r ? 'hotel_reservation' : 'hotel_guest_profile', entityId: r?.id || prof.id,
        guest_name: prof.fullName, guest_first_name: String(prof.fullName || '').trim().split(/\s+/)[0] || '', guest_email: prof.email || '', guest_phone: prof.phone || '',
        guest_lang: lang, recipient_lang: lang, marketing_consent: prof.marketingConsent ? 'yes' : 'no',
        program_name: p.name, member_number: fresh.number, tier_name: tier?.name || '', tier_discount: String(tier?.discountPct || 0),
        points_balance: String(fresh.points), points_value: String(r2(fresh.points * p.settings.points.pointValue)), currency: p.currency,
        loyalty_link: `${base}/lp/${fresh.token}`, booking_code: r?.bookingCode || '', check_in: r?.checkIn || '', check_out: r?.checkOut || '',
        ...extra,
      });
    } catch (e) {
      this.log.warn(`loyalty event ${event}: ${(e as Error).message}`);
    }
  }

  /** Для отчётов: участники по уровням, баллы выдано / потрачено / сгорело за период */
  async overview(tenantId: string, programId: string, days = 90) {
    const p = await this.programs.findOne({ where: { id: programId, tenantId } });
    if (!p) throw new NotFoundException('Программа не найдена');
    const since = new Date(Date.now() - Math.min(730, Math.max(1, days)) * 86_400_000);
    const [tiers, tx, joined] = await Promise.all([
      this.members.manager.query(`SELECT tier, COUNT(*)::int AS n FROM hotel_loyalty_members WHERE "programId" = $1 GROUP BY tier`, [p.id]),
      this.txs.manager.query(`SELECT type, COALESCE(SUM(points), 0)::int AS points FROM hotel_loyalty_tx WHERE "programId" = $1 AND status = 'posted' AND "createdAt" >= $2 GROUP BY type`, [p.id, since]),
      this.members.manager.query(`SELECT COUNT(*)::int AS n FROM hotel_loyalty_members WHERE "programId" = $1 AND "joinedAt" >= $2`, [p.id, since]),
    ]);
    const t = (k: string) => Number(tx.find((x: any) => x.type === k)?.points || 0);
    return {
      days, byTier: p.settings.tiers.map((x) => ({ key: x.key, name: x.name, members: Number(tiers.find((y: any) => y.tier === x.key)?.n || 0) })).concat([{ key: '', name: '—', members: Number(tiers.find((y: any) => y.tier === null)?.n || 0) }]),
      earned: t('earn') + Math.max(0, t('adjust')), redeemed: -(t('redeem') + t('reverse')), expired: -t('expire'), joined: Number(joined[0]?.n || 0),
    };
  }
}
