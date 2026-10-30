import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Observable, Subject, filter, interval, map, merge } from 'rxjs';

/** Что изменилось: страница по типу решает, что перечитать (шахматка — брони, номера, OOO; уборка — задачи…) */
export type HotelLiveEntity = 'reservation' | 'unit' | 'housekeeping' | 'outage' | 'request';

export type HotelLiveEvent =
  | { type: 'changed'; entity: HotelLiveEntity; id: string; hotelId: string | null; action: 'insert' | 'update' | 'remove' }
  | { type: 'locks'; locks: HotelEditLock[] };

export interface HotelEditLock {
  reservationId: string;
  userId: string;
  userName: string;
  expiresAt: number;
}

const TICKET_TTL_MS = 60_000;
const LOCK_TTL_MS = 45_000;

/**
 * Живые обновления PMS: шина событий по компаниям (один процесс API — без Redis) + мягкие блокировки «бронь редактирует N».
 * Поток — Server-Sent Events: EventSource не умеет заголовки, поэтому вход по одноразовому билету (выдаётся по обычному JWT),
 * а не по токену в адресе (он попал бы в логи nginx).
 */
@Injectable()
export class HotelLiveService implements OnModuleDestroy {
  private readonly bus = new Subject<{ tenantId: string; event: HotelLiveEvent }>();
  private readonly tickets = new Map<string, { tenantId: string; userId: string; expiresAt: number }>();
  private readonly locks = new Map<string, Map<string, HotelEditLock>>();
  private readonly sweeper = setInterval(() => this.sweep(), 15_000);

  onModuleDestroy() {
    clearInterval(this.sweeper);
    this.bus.complete();
  }

  publish(tenantId: string, event: HotelLiveEvent) {
    this.bus.next({ tenantId, event });
  }

  /** Подписка внутри сервера (менеджер каналов: поменялась занятость → выгрузить наличие) */
  onEvent(cb: (tenantId: string, event: HotelLiveEvent) => void) {
    return this.bus.subscribe(({ tenantId, event }) => cb(tenantId, event));
  }

  issueTicket(tenantId: string, userId: string) {
    const ticket = randomBytes(24).toString('hex');
    this.tickets.set(ticket, { tenantId, userId, expiresAt: Date.now() + TICKET_TTL_MS });
    return { ticket, expiresInSec: TICKET_TTL_MS / 1000 };
  }

  /** Билет одноразовый: при переподключении клиент берёт новый */
  redeemTicket(ticket: string | undefined) {
    if (!ticket) return null;
    const t = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    return t && t.expiresAt > Date.now() ? t : null;
  }

  /** Поток компании: события + текущие блокировки сразу при подключении + «пульс» раз в 25 с (держит соединение за nginx) */
  stream(tenantId: string): Observable<{ data: unknown; type?: string }> {
    const events = this.bus.pipe(
      filter((x) => x.tenantId === tenantId),
      map((x) => ({ data: x.event })),
    );
    const ping = interval(25_000).pipe(map(() => ({ data: { type: 'ping' } })));
    return new Observable((sub) => {
      sub.next({ data: { type: 'locks', locks: this.listLocks(tenantId) } });
      const s = merge(events, ping).subscribe(sub);
      return () => s.unsubscribe();
    });
  }

  listLocks(tenantId: string): HotelEditLock[] {
    const now = Date.now();
    return [...(this.locks.get(tenantId)?.values() || [])].filter((l) => l.expiresAt > now);
  }

  /** Взять/продлить блокировку. Чужая живая блокировка не перебивается — возвращается она, ok=false */
  acquire(tenantId: string, reservationId: string, userId: string, userName: string) {
    const m = this.locks.get(tenantId) || new Map<string, HotelEditLock>();
    this.locks.set(tenantId, m);
    const cur = m.get(reservationId);
    if (cur && cur.userId !== userId && cur.expiresAt > Date.now()) return { ok: false, lock: cur };
    const lock = { reservationId, userId, userName, expiresAt: Date.now() + LOCK_TTL_MS };
    m.set(reservationId, lock);
    if (!cur || cur.userId !== userId) this.publishLocks(tenantId);
    return { ok: true, lock };
  }

  release(tenantId: string, reservationId: string, userId: string) {
    const m = this.locks.get(tenantId);
    const cur = m?.get(reservationId);
    if (!m || !cur || cur.userId !== userId) return { ok: false };
    m.delete(reservationId);
    this.publishLocks(tenantId);
    return { ok: true };
  }

  private publishLocks(tenantId: string) {
    this.publish(tenantId, { type: 'locks', locks: this.listLocks(tenantId) });
  }

  private sweep() {
    const now = Date.now();
    for (const [k, t] of this.tickets) if (t.expiresAt <= now) this.tickets.delete(k);
    for (const [tenantId, m] of this.locks) {
      let changed = false;
      for (const [id, l] of m) if (l.expiresAt <= now) { m.delete(id); changed = true; }
      if (changed) this.publishLocks(tenantId);
      if (!m.size) this.locks.delete(tenantId);
    }
  }
}
