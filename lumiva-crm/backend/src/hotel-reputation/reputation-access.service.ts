import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hotel } from '../hotels/hotel.entity';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { listParam } from './reputation.constants';

/** Ни одного отеля не доступно — фильтр, который ничего не находит (вместо «нет фильтра = всё»). */
const NO_HOTEL = '00000000-0000-0000-0000-000000000000';

export interface HotelAccessGrant {
  userId: string;
  hotelIds: string[];
  brandIds: string[];
}

/**
 * Доступ сотрудника к отелям (директор видит только свои). Нет записи — все отели, как раньше;
 * владелец аккаунта — всегда все. Проверяется на сервере в каждом запросе модуля отзывов.
 */
@Injectable()
export class ReputationAccessService {
  private cache = new Map<string, { at: number; ids: string[] | null }>();

  constructor(@InjectRepository(Hotel) private readonly hotels: Repository<Hotel>) {}

  private uid(u: CurrentUserPayload): string {
    return (u.userId ?? u.id ?? u.sub) || '';
  }

  /** null — все отели; иначе список доступных id (может быть пустым). */
  async allowed(u: CurrentUserPayload): Promise<string[] | null> {
    if (u.role === 'owner') return null;
    const uid = this.uid(u);
    if (!uid) return [];
    const key = `${u.tenantId}:${uid}`;
    const c = this.cache.get(key);
    if (c && Date.now() - c.at < 30_000) return c.ids;
    const [row] = await this.hotels.query(`SELECT "hotelIds", "brandIds" FROM hotel_user_access WHERE "tenantId" = $1 AND "userId" = $2`, [u.tenantId, uid]);
    let ids: string[] | null = null;
    if (row) {
      const found: Array<{ id: string }> = await this.hotels.query(
        `SELECT id FROM hotels WHERE "tenantId" = $1 AND (id = ANY($2::uuid[]) OR "brandId" = ANY($3::uuid[]))`,
        [u.tenantId, row.hotelIds || [], row.brandIds || []],
      );
      ids = found.map((x) => x.id);
    }
    this.cache.set(key, { at: Date.now(), ids });
    return ids;
  }

  /** Фильтр запроса «отели» сужается до доступных (выбранные ∩ доступные; ничего не выбрано — все доступные). */
  async restrict<T extends { hotelId?: string }>(u: CurrentUserPayload, q: T): Promise<T> {
    const ids = await this.allowed(u);
    if (!ids) return q;
    const asked = listParam(q?.hotelId, 'uuid');
    const set = asked.length ? asked.filter((x) => ids.includes(x)) : ids;
    return { ...(q || ({} as T)), hotelId: (set.length ? set : [NO_HOTEL]).join(',') };
  }

  async canSeeHotel(u: CurrentUserPayload, hotelId: string | null | undefined): Promise<boolean> {
    const ids = await this.allowed(u);
    return !ids || (!!hotelId && ids.includes(hotelId));
  }

  async assertHotel(u: CurrentUserPayload, hotelId: string | null | undefined) {
    if (!(await this.canSeeHotel(u, hotelId))) throw new NotFoundException('Hotel not found');
  }

  async assertReview(u: CurrentUserPayload, reviewId: string) {
    if (!(await this.allowed(u))) return;
    const [r] = await this.hotels.query(`SELECT "hotelId" FROM hotel_reviews WHERE id = $1 AND "tenantId" = $2`, [reviewId, u.tenantId]);
    await this.assertHotel(u, r?.hotelId);
  }

  async assertReply(u: CurrentUserPayload, replyId: string) {
    if (!(await this.allowed(u))) return;
    const [r] = await this.hotels.query(
      `SELECT rv."hotelId" FROM hotel_review_replies p JOIN hotel_reviews rv ON rv.id = p."reviewId" WHERE p.id = $1 AND p."tenantId" = $2`,
      [replyId, u.tenantId],
    );
    await this.assertHotel(u, r?.hotelId);
  }

  /** Пара «возможный дубликат»: оба отзыва должны быть из доступных отелей. */
  async assertDuplicatePair(u: CurrentUserPayload, pairId: string) {
    const ids = await this.allowed(u);
    if (!ids) return;
    const rows: Array<{ hotelId: string }> = await this.hotels.query(
      `SELECT rv."hotelId" FROM hotel_review_duplicates d JOIN hotel_reviews rv ON rv.id IN (d."reviewId", d."candidateId") WHERE d.id = $1 AND rv."tenantId" = $2`,
      [pairId, u.tenantId],
    );
    if (!rows.length || rows.some((x) => !ids.includes(x.hotelId))) throw new NotFoundException('Duplicate pair not found');
  }

  /** Месячный отчёт бренда: только если все отели бренда доступны (отчёт «по всем» — только без ограничения). */
  async assertBrandReport(u: CurrentUserPayload, brandId: string | null) {
    const ids = await this.allowed(u);
    if (!ids) return;
    if (!brandId) throw new ForbiddenException({ code: 'HOTEL_ACCESS_LIMITED', message: 'Choose a brand you have access to' });
    const rows: Array<{ id: string }> = await this.hotels.query(`SELECT id FROM hotels WHERE "tenantId" = $1 AND "brandId" = $2`, [u.tenantId, brandId]);
    if (!rows.length || rows.some((x) => !ids.includes(x.id))) throw new ForbiddenException({ code: 'HOTEL_ACCESS_LIMITED', message: 'No access to all hotels of this brand' });
  }

  /** Настройки модуля, площадки, бюджет Apify — только у сотрудников без ограничения по отелям. */
  async requireFull(u: CurrentUserPayload) {
    if (await this.allowed(u)) throw new ForbiddenException({ code: 'HOTEL_ACCESS_LIMITED', message: 'Available only to staff with access to all hotels' });
  }

  // ---------------------------------------------------------------- управление (владелец)

  private assertOwner(u: CurrentUserPayload) {
    if (u.role !== 'owner') throw new ForbiddenException('Only the account owner can manage hotel access');
  }

  /** Сотрудники аккаунта и их доступ (владелец не ограничивается — в списке не показываем). */
  async list(u: CurrentUserPayload) {
    this.assertOwner(u);
    const users: Array<{ id: string; name: string | null; email: string; role: string }> = await this.hotels.query(
      `SELECT id, name, email, role FROM users WHERE "tenantId" = $1 AND role <> 'owner' ORDER BY COALESCE(NULLIF(name, ''), email)`,
      [u.tenantId],
    );
    const grants: Array<{ userId: string; hotelIds: string[]; brandIds: string[] }> = await this.hotels.query(
      `SELECT "userId", "hotelIds", "brandIds" FROM hotel_user_access WHERE "tenantId" = $1`,
      [u.tenantId],
    );
    return users.map((x) => {
      const g = grants.find((y) => y.userId === x.id);
      return { ...x, limited: !!g, hotelIds: g?.hotelIds || [], brandIds: g?.brandIds || [] };
    });
  }

  /** limited=false — снять ограничение (все отели). */
  async set(u: CurrentUserPayload, userId: string, b: { limited?: boolean; hotelIds?: string[]; brandIds?: string[] }) {
    this.assertOwner(u);
    const [target] = await this.hotels.query(`SELECT id, role FROM users WHERE id = $1 AND "tenantId" = $2`, [userId, u.tenantId]);
    if (!target) throw new NotFoundException('User not found');
    if (target.role === 'owner') throw new ForbiddenException('The account owner always sees all hotels');
    if (b?.limited === false) {
      await this.hotels.query(`DELETE FROM hotel_user_access WHERE "tenantId" = $1 AND "userId" = $2`, [u.tenantId, userId]);
    } else {
      // только свои отели/бренды этого аккаунта
      const hotelIds: string[] = (
        await this.hotels.query(`SELECT id FROM hotels WHERE "tenantId" = $1 AND id = ANY($2::uuid[])`, [u.tenantId, listParam(b?.hotelIds || [], 'uuid')])
      ).map((x: any) => x.id);
      const brandIds: string[] = (
        await this.hotels.query(`SELECT id FROM hotel_brands WHERE "tenantId" = $1 AND id = ANY($2::uuid[])`, [u.tenantId, listParam(b?.brandIds || [], 'uuid')])
      ).map((x: any) => x.id);
      await this.hotels.query(
        `INSERT INTO hotel_user_access ("tenantId", "userId", "hotelIds", "brandIds", "updatedAt") VALUES ($1, $2, $3::uuid[], $4::uuid[], now())
         ON CONFLICT ("tenantId", "userId") DO UPDATE SET "hotelIds" = EXCLUDED."hotelIds", "brandIds" = EXCLUDED."brandIds", "updatedAt" = now()`,
        [u.tenantId, userId, hotelIds, brandIds],
      );
    }
    this.cache.delete(`${u.tenantId}:${userId}`);
    return (await this.list(u)).find((x) => x.id === userId);
  }

  /** Для интерфейса: ограничен ли текущий пользователь и какими отелями. */
  async me(u: CurrentUserPayload) {
    const ids = await this.allowed(u);
    return { limited: !!ids, hotelIds: ids || [] };
  }
}
