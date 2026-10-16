import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { isComponentAllowedByPlan } from '../tenants/plan-entitlements';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { HotelReservation } from '../hotels/hotel-reservation.entity';
import { HotelRoomUnit } from '../hotels/hotel-room-unit.entity';
import { HotelRoomType } from '../hotels/hotel-room-type.entity';
import { HotelReview } from './reputation.entities';
import { ReputationSettingsService } from './reputation-settings.service';

const DAY = 864e5;
/** Отзыв пишут во время проживания или в течение двух месяцев после выезда. */
const AFTER_CHECKOUT_DAYS = 60;

type Strength = 'full' | 'initial' | null;

/**
 * Включён ли у тенанта модуль броней (компоненты «Отели» и «Брони» в pl1; явный флаг тенанта, иначе — по тарифу).
 * Выключен — клиент не видит брони, значит связка «отзыв → бронь / номер» тоже не работает и не показывается.
 */
export async function reservationsComponentOn(query: (sql: string, p: unknown[]) => Promise<any[]>, tenantId: string): Promise<boolean> {
  const [t] = await query(`SELECT "enabledComponents" AS c, plan FROM tenants WHERE id = $1`, [tenantId]);
  if (!t) return false;
  const on = (key: string) => (typeof t.c?.[key] === 'boolean' ? t.c[key] : isComponentAllowedByPlan(key, t.plan));
  return on('hotels') && on('hotels_reservations');
}

/** Части имени без регистра, диакритики и пунктуации: «Müller-Lüdenscheidt, Anna» → [muller, ludenscheidt, anna]. */
function nameParts(v: string | null | undefined): string[] {
  return (v || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L} ]+/gu, ' ')
    .split(' ')
    .filter(Boolean);
}

/**
 * Насколько автор отзыва похож на гостя брони. full — все части имени автора (минимум две) есть в имени гостя;
 * initial — «Maria K.» / «Daniels V»: имя совпало, фамилия только инициалом. Только имя («Maria») — не совпадение:
 * таких гостей в отеле десятки.
 */
export function guestNameMatch(author: string | null, guest: string | null): Strength {
  const a = nameParts(author);
  const g = nameParts(guest);
  if (a.length < 2 || g.length < 2) return null;
  const full = a.filter((p) => p.length > 1);
  if (full.length >= 2 && full.every((p) => g.includes(p))) return 'full';
  const initials = a.filter((p) => p.length === 1);
  if (full.length >= 1 && initials.length >= 1 && full.every((p) => g.includes(p)) && initials.every((i) => g.some((p) => p !== full[0] && p.startsWith(i)))) return 'initial';
  return null;
}

/**
 * Отзыв ↔ бронь (номер, даты проживания) — из модуля «Отели». Уверенное совпадение (полное имя, одна бронь
 * в окне проживания) связывается само; «Maria K.» — предлагается человеку; несколько подходящих — только ручной выбор.
 * Связь даёт номер в карточке отзыва, задачах и аналитику «номера с жалобами».
 */
@Injectable()
export class ReputationReservationsService {
  private readonly log = new Logger(ReputationReservationsService.name);

  constructor(
    @InjectRepository(HotelReview) private readonly reviews: Repository<HotelReview>,
    @InjectRepository(HotelReservation) private readonly reservations: Repository<HotelReservation>,
    @InjectRepository(HotelRoomUnit) private readonly units: Repository<HotelRoomUnit>,
    @InjectRepository(HotelRoomType) private readonly roomTypes: Repository<HotelRoomType>,
    private readonly settings: ReputationSettingsService,
  ) {}

  /** Брони отеля, в окне проживания которых мог быть написан отзыв. */
  private async window(r: Pick<HotelReview, 'tenantId' | 'hotelId' | 'publishedAt'>) {
    if (!r.publishedAt) return [];
    const p = r.publishedAt.getTime();
    return this.reservations
      .createQueryBuilder('x')
      .where('x.tenantId = :t AND x.hotelId = :h AND x.status <> :c', { t: r.tenantId, h: r.hotelId, c: 'cancelled' })
      .andWhere('x.checkIn <= :latestIn AND x.checkOut >= :earliestOut', {
        latestIn: new Date(p + DAY).toISOString().slice(0, 10),
        earliestOut: new Date(p - AFTER_CHECKOUT_DAYS * DAY).toISOString().slice(0, 10),
      })
      .take(2000)
      .getMany();
  }

  private scoreAgainst(author: string | null, res: HotelReservation): Strength {
    let best: Strength = guestNameMatch(author, res.guestName);
    if (best === 'full') return best;
    for (const g of res.guests || []) {
      const s = guestNameMatch(author, g?.fullName);
      if (s === 'full') return 'full';
      if (s === 'initial') best = 'initial';
    }
    return best;
  }

  private async componentOn(tenantId: string) {
    return reservationsComponentOn((sql, p) => this.reviews.query(sql, p), tenantId);
  }

  private async requireComponent(tenantId: string) {
    if (!(await this.componentOn(tenantId))) throw new ForbiddenException('Reservations component is disabled');
  }

  /** Кандидаты для одного отзыва: сначала полные совпадения имени, потом «имя + инициал». */
  async candidates(tenantId: string, reviewId: string) {
    await this.requireComponent(tenantId);
    const r = await this.reviews.findOne({ where: { id: reviewId, tenantId } });
    if (!r) throw new NotFoundException('Review not found');
    const list = await this.window(r);
    const scored = list
      .map((x) => ({ x, s: this.scoreAgainst(r.author, x) }))
      .filter((y) => y.s)
      .sort((a, b) => (a.s === b.s ? 0 : a.s === 'full' ? -1 : 1));
    return this.brief(tenantId, scored.slice(0, 10).map((y) => y.x), new Map(scored.map((y) => [y.x.id, y.s!])));
  }

  /** Подбор для новых / непроверенных отзывов. Решения человека (confirmed / rejected) не трогаем. */
  async matchReviews(tenantId: string, reviewIds?: string[]) {
    if (!(await this.componentOn(tenantId))) return { checked: 0, auto: 0, suggested: 0 };
    const hasAny = await this.reservations.count({ where: { tenantId } });
    if (!hasAny) return { checked: 0, auto: 0, suggested: 0 };
    const qb = this.reviews
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId AND r.reservationMatch IS NULL AND r.author IS NOT NULL AND r.status <> :d', { tenantId, d: 'deleted' });
    if (reviewIds) {
      if (!reviewIds.length) return { checked: 0, auto: 0, suggested: 0 };
      qb.andWhere('r.id IN (:...ids)', { ids: reviewIds });
    } else {
      const cfg = await this.settings.config(tenantId);
      const earliest = await this.reservations.createQueryBuilder('x').select('MIN(x.checkIn)', 'm').where('x.tenantId = :tenantId', { tenantId }).getRawOne();
      const floor = Math.max(new Date(cfg.historyFrom || '2000-01-01').getTime(), earliest?.m ? new Date(earliest.m).getTime() : 0);
      qb.andWhere('r.publishedAt >= :floor', { floor: new Date(floor) });
    }
    const rows = await qb.getMany();
    let auto = 0;
    let suggested = 0;
    for (const r of rows) {
      const list = await this.window(r);
      if (!list.length) continue;
      const full = list.filter((x) => this.scoreAgainst(r.author, x) === 'full');
      const initial = list.filter((x) => this.scoreAgainst(r.author, x) === 'initial');
      if (full.length === 1) {
        await this.reviews.update({ id: r.id }, { reservationId: full[0].id, reservationMatch: 'auto' });
        auto++;
      } else if (!full.length && initial.length === 1) {
        await this.reviews.update({ id: r.id }, { reservationId: initial[0].id, reservationMatch: 'suggested' });
        suggested++;
      }
    }
    return { checked: rows.length, auto, suggested };
  }

  /** Решение человека: привязать (в т. ч. выбранную вручную), подтвердить предложенную, отклонить или отвязать. */
  async decide(tenantId: string, reviewId: string, body: { action?: string; reservationId?: string }) {
    await this.requireComponent(tenantId);
    const r = await this.reviews.findOne({ where: { id: reviewId, tenantId } });
    if (!r) throw new NotFoundException('Review not found');
    const action = String(body?.action || '');
    if (action === 'link') {
      const res = await this.reservations.findOne({ where: { id: String(body?.reservationId || ''), tenantId } });
      if (!res) throw new NotFoundException('Reservation not found');
      if (res.hotelId !== r.hotelId) throw new BadRequestException('The reservation belongs to another hotel');
      await this.reviews.update({ id: r.id }, { reservationId: res.id, reservationMatch: 'confirmed' });
    } else if (action === 'confirm') {
      if (!r.reservationId) throw new BadRequestException('Nothing to confirm');
      await this.reviews.update({ id: r.id }, { reservationMatch: 'confirmed' });
    } else if (action === 'reject' || action === 'unlink') {
      // «не тот гость» — больше не предлагать автоматически (вручную привязать можно)
      await this.reviews.update({ id: r.id }, { reservationId: null, reservationMatch: 'rejected' });
    } else throw new BadRequestException('Unknown action');
  }

  private async brief(tenantId: string, list: HotelReservation[], strength?: Map<string, Strength>) {
    if (!list.length) return [];
    const unitIds = [...new Set(list.map((x) => x.roomUnitId).filter(Boolean))] as string[];
    const typeIds = [...new Set(list.map((x) => x.roomTypeId).filter(Boolean))];
    const [units, types] = await Promise.all([
      unitIds.length ? this.units.find({ where: { id: In(unitIds), tenantId } }) : Promise.resolve([] as HotelRoomUnit[]),
      typeIds.length ? this.roomTypes.find({ where: { id: In(typeIds) } }) : Promise.resolve([] as HotelRoomType[]),
    ]);
    return list.map((x) => ({
      id: x.id,
      guestName: x.guestName,
      checkIn: String(x.checkIn).slice(0, 10),
      checkOut: String(x.checkOut).slice(0, 10),
      status: x.status,
      bookingCode: x.bookingCode,
      room: units.find((u) => u.id === x.roomUnitId)?.label ?? null,
      roomType: (types.find((t) => t.id === x.roomTypeId) as any)?.name ?? null,
      market: x.market,
      match: strength?.get(x.id) ?? null,
    }));
  }

  /** Для карточки отзыва: связанная бронь (с номером) и её статус. */
  async cardInfo(tenantId: string, r: HotelReview) {
    if (!(await this.componentOn(tenantId))) return null;
    const hasAny = await this.reservations.count({ where: { tenantId, hotelId: r.hotelId } });
    if (!hasAny) return null; // отель без броней в CRM — блок не показываем
    const res = r.reservationId ? await this.reservations.findOne({ where: { id: r.reservationId, tenantId } }) : null;
    const [b] = res ? await this.brief(tenantId, [res]) : [];
    return { reservation: b || null, match: r.reservationMatch };
  }

  /** Короткая строка для задач/токенов: «номер 312 · 02.10–09.10 · Anna Müller». */
  async roomLine(tenantId: string, r: Pick<HotelReview, 'reservationId'>): Promise<string | null> {
    if (!r.reservationId || !(await this.componentOn(tenantId))) return null;
    const res = await this.reservations.findOne({ where: { id: r.reservationId, tenantId } });
    if (!res) return null;
    const [b] = await this.brief(tenantId, [res]);
    const fmt = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
    return [b.room ? `№ ${b.room}` : b.roomType, `${fmt(b.checkIn)}–${fmt(b.checkOut)}`, b.guestName].filter(Boolean).join(' · ');
  }

  /**
   * Номера с жалобами: негативные отзывы, связанные с бронью, по номерам (и по типам номеров, если номер
   * не назначен). Только связи auto / confirmed — предложенные ещё не проверены человеком.
   */
  async roomsStats(tenantId: string, q: { hotelIds: string[]; from: Date; to: Date; negBelow: number }) {
    const rows: any[] = await this.reviews.query(
      `SELECT r."hotelId", x."roomUnitId", x."roomTypeId", COUNT(*)::int AS n,
              COUNT(*) FILTER (WHERE r.rating10 < $5)::int AS neg, AVG(r.rating10) AS avg,
              (array_agg(r.id ORDER BY r."publishedAt" DESC) FILTER (WHERE r.rating10 < $5))[1:5] AS neg_ids
         FROM hotel_reviews r JOIN hotel_reservations x ON x.id = r."reservationId"
        WHERE r."tenantId" = $1 AND r."hotelId" = ANY($2) AND r."publishedAt" >= $3 AND r."publishedAt" < $4
          AND r.status <> 'deleted' AND r."duplicateOfId" IS NULL AND r."reservationMatch" IN ('auto', 'confirmed')
        GROUP BY 1, 2, 3`,
      [tenantId, q.hotelIds, q.from, q.to, q.negBelow],
    );
    const [linked] = await this.reviews.query(
      `SELECT COUNT(*) FILTER (WHERE r."reservationMatch" IN ('auto', 'confirmed'))::int AS linked,
              COUNT(*) FILTER (WHERE r."reservationMatch" = 'suggested')::int AS suggested
         FROM hotel_reviews r WHERE r."tenantId" = $1 AND r."hotelId" = ANY($2) AND r."publishedAt" >= $3 AND r."publishedAt" < $4 AND r.status <> 'deleted'`,
      [tenantId, q.hotelIds, q.from, q.to],
    );
    if (!rows.length) return { linked: linked?.linked ?? 0, suggested: linked?.suggested ?? 0, rooms: [] };
    const unitIds = [...new Set(rows.map((x) => x.roomUnitId).filter(Boolean))];
    const typeIds = [...new Set(rows.map((x) => x.roomTypeId).filter(Boolean))];
    const [units, types] = await Promise.all([
      unitIds.length ? this.units.find({ where: { id: In(unitIds) } }) : Promise.resolve([] as HotelRoomUnit[]),
      typeIds.length ? this.roomTypes.find({ where: { id: In(typeIds) } }) : Promise.resolve([] as HotelRoomType[]),
    ]);
    const rooms = rows
      .map((x) => ({
        hotelId: x.hotelId,
        roomUnitId: x.roomUnitId,
        room: units.find((u) => u.id === x.roomUnitId)?.label ?? null,
        roomType: (types.find((t) => t.id === x.roomTypeId) as any)?.name ?? null,
        reviews: x.n,
        negative: x.neg,
        avg10: x.avg != null ? Math.round(Number(x.avg) * 100) / 100 : null,
        negativeReviewIds: (x.neg_ids || []).filter(Boolean),
      }))
      .filter((x) => x.negative > 0)
      .sort((a, b) => b.negative - a.negative || (a.avg10 ?? 10) - (b.avg10 ?? 10))
      .slice(0, 20);
    return { linked: linked?.linked ?? 0, suggested: linked?.suggested ?? 0, rooms };
  }

  /** Есть ли у тенанта брони вообще (без них связка не имеет смысла). */
  async enabled(tenantId: string) {
    return (await this.componentOn(tenantId)) && (await this.reservations.count({ where: { tenantId } })) > 0;
  }

  /** Отзывы без проверки — для ночного подбора. */
  async pendingCount(tenantId: string) {
    return this.reviews.count({ where: { tenantId, reservationMatch: IsNull() } });
  }
}
