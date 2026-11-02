import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { BookingZone, BookingZoneDecor } from './booking-zone.entity';
import { BookingResource } from './booking-resource.entity';
import { BookingMenuCategory } from './booking-menu-category.entity';
import { BookingMenuItem } from './booking-menu-item.entity';
import { BookingLocation } from './booking-location.entity';
import { Reservation, RESERVATION_ACTIVE_STATUSES } from './reservation.entity';
import { BookingsProjectsService } from './bookings-projects.service';
import { BookingsAvailabilityService } from './bookings-availability.service';
import { ReservationsService } from './reservations.service';
import { BookingsOrdersService } from './bookings-orders.service';
import { safeTimeZone, zonedParts, zonedToUtc } from './booking-time.util';

const TABLE_SHAPES = ['round', 'square', 'rect', 'booth', 'bar'];
const DECOR_KINDS = ['wall', 'bar', 'entrance', 'window', 'kitchen', 'plant', 'stage', 'label'];
const clampInt = (v: unknown, min: number, max: number, def: number) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
};

export interface LayoutTableInput {
  id?: string;
  name: string;
  shape: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation?: number;
  capacity: number;
  minCapacity?: number | null;
  active?: boolean;
}

export type FloorTableState = 'free' | 'soon' | 'reserved' | 'seated' | 'billed' | 'inactive';

/** Ресторан: залы, расстановка столов, меню, живой план посадки. */
@Injectable()
export class BookingsRestaurantService {
  constructor(
    @InjectRepository(BookingZone) private readonly zones: Repository<BookingZone>,
    @InjectRepository(BookingResource) private readonly resources: Repository<BookingResource>,
    @InjectRepository(BookingMenuCategory) private readonly categories: Repository<BookingMenuCategory>,
    @InjectRepository(BookingMenuItem) private readonly menuItems: Repository<BookingMenuItem>,
    @InjectRepository(BookingLocation) private readonly locations: Repository<BookingLocation>,
    @InjectRepository(Reservation) private readonly reservationsRepo: Repository<Reservation>,
    private readonly projects: BookingsProjectsService,
    private readonly availability: BookingsAvailabilityService,
    private readonly reservations: ReservationsService,
    private readonly orders: BookingsOrdersService,
  ) {}

  /* ---------- залы ---------- */

  async listZones(tenantId: string, locationId?: string) {
    const where: any = { tenantId };
    if (locationId) where.locationId = locationId;
    const zones = await this.zones.find({ where, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
    const tables = zones.length
      ? await this.resources.find({ where: { tenantId, zoneId: In(zones.map((z) => z.id)) }, order: { name: 'ASC' } })
      : [];
    return zones.map((z) => ({ ...z, tables: tables.filter((t) => t.zoneId === z.id) }));
  }

  async createZone(tenantId: string, dto: Partial<BookingZone>) {
    if (!dto.name?.trim()) throw new BadRequestException('Укажите название зала');
    if (!dto.locationId) throw new BadRequestException('Укажите локацию');
    const loc = await this.locations.findOne({ where: { id: dto.locationId, tenantId } });
    if (!loc) throw new BadRequestException('Локация не найдена');
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const count = await this.zones.count({ where: { tenantId, locationId: loc.id } });
    return this.zones.save(
      this.zones.create({
        tenantId,
        projectId: project.id,
        locationId: loc.id,
        name: dto.name.trim(),
        color: dto.color || null,
        width: clampInt(dto.width, 400, 4000, 1000),
        height: clampInt(dto.height, 300, 3000, 640),
        sortOrder: count,
        decor: [],
      }),
    );
  }

  async updateZone(tenantId: string, id: string, dto: Partial<BookingZone>) {
    const zone = await this.zones.findOne({ where: { id, tenantId } });
    if (!zone) throw new NotFoundException('Зал не найден');
    if (dto.name !== undefined) zone.name = String(dto.name).trim() || zone.name;
    if (dto.color !== undefined) zone.color = dto.color || null;
    if (dto.width !== undefined) zone.width = clampInt(dto.width, 400, 4000, zone.width);
    if (dto.height !== undefined) zone.height = clampInt(dto.height, 300, 3000, zone.height);
    if (dto.sortOrder !== undefined) zone.sortOrder = clampInt(dto.sortOrder, 0, 1000, zone.sortOrder);
    if (dto.active !== undefined) zone.active = !!dto.active;
    return this.zones.save(zone);
  }

  async deleteZone(tenantId: string, id: string) {
    const zone = await this.zones.findOne({ where: { id, tenantId } });
    if (!zone) throw new NotFoundException('Зал не найден');
    const tables = await this.resources.find({ where: { tenantId, zoneId: id } });
    if (tables.length) {
      const ids = tables.map((t) => t.id);
      const future = await this.reservationsRepo
        .createQueryBuilder('r')
        .where('r.tenantId = :tenantId AND r.resourceId IN (:...ids)', { tenantId, ids })
        .andWhere('r.status IN (:...st) AND r.endAt > now()', { st: RESERVATION_ACTIVE_STATUSES })
        .getCount();
      if (future) throw new BadRequestException(`В зале есть ${future} предстоящих броней — перенесите их на другие столы`);
      // столы без зала не удаляем (у них может быть история броней) — снимаем с плана и выключаем
      await this.resources.update({ tenantId, id: In(ids) }, { zoneId: null, active: false });
    }
    await this.zones.delete({ id, tenantId });
    return { ok: true };
  }

  /**
   * Сохранение плана зала одним запросом из редактора: столы (создать/обновить/снять с плана)
   * и декор. Столы — BookingResource(type='table'), чтобы брони и конфликты работали как у
   * любого ресурса.
   */
  async saveLayout(
    tenantId: string,
    zoneId: string,
    dto: { tables: LayoutTableInput[]; decor?: BookingZoneDecor[]; removedTableIds?: string[]; width?: number; height?: number },
  ) {
    const zone = await this.zones.findOne({ where: { id: zoneId, tenantId } });
    if (!zone) throw new NotFoundException('Зал не найден');
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    if (dto.width !== undefined) zone.width = clampInt(dto.width, 400, 4000, zone.width);
    if (dto.height !== undefined) zone.height = clampInt(dto.height, 300, 3000, zone.height);
    if (Array.isArray(dto.decor)) {
      zone.decor = dto.decor
        .filter((d) => DECOR_KINDS.includes(d.kind))
        .slice(0, 200)
        .map((d) => ({
          id: d.id || randomUUID(),
          kind: d.kind,
          x: clampInt(d.x, -50, zone.width, 0),
          y: clampInt(d.y, -50, zone.height, 0),
          w: clampInt(d.w, 4, zone.width, 80),
          h: clampInt(d.h, 4, zone.height, 20),
          rotation: clampInt(d.rotation ?? 0, -360, 360, 0),
          label: d.label ? String(d.label).slice(0, 60) : null,
        }));
    }
    await this.zones.save(zone);

    const names = new Set<string>();
    for (const t of dto.tables || []) {
      const name = String(t.name || '').trim();
      if (!name) throw new BadRequestException('У каждого стола должен быть номер/название');
      if (names.has(name.toLowerCase())) throw new BadRequestException(`Стол «${name}» встречается дважды`);
      names.add(name.toLowerCase());
    }

    const existing = await this.resources.find({ where: { tenantId, zoneId } });
    for (const t of dto.tables || []) {
      const shape = TABLE_SHAPES.includes(t.shape) ? t.shape : 'square';
      const fields = {
        name: String(t.name).trim().slice(0, 255),
        shape,
        posX: clampInt(t.posX, 0, zone.width, 20),
        posY: clampInt(t.posY, 0, zone.height, 20),
        width: clampInt(t.width, 30, 600, 80),
        height: clampInt(t.height, 30, 600, 80),
        rotation: clampInt(t.rotation ?? 0, -360, 360, 0),
        capacity: clampInt(t.capacity, 1, 100, 2),
        minCapacity: t.minCapacity != null && t.minCapacity !== ('' as any) ? clampInt(t.minCapacity, 1, 100, 1) : null,
        active: t.active !== false,
      };
      const current = t.id ? existing.find((e) => e.id === t.id) : null;
      if (current) {
        Object.assign(current, fields);
        await this.resources.save(current);
      } else {
        await this.resources.save(
          this.resources.create({ ...fields, tenantId, projectId: project.id, locationId: zone.locationId, zoneId, type: 'table', quantity: 1 }),
        );
      }
    }
    for (const id of dto.removedTableIds || []) {
      const t = existing.find((e) => e.id === id);
      if (!t) continue;
      const hasHistory = await this.reservationsRepo.exists({ where: { tenantId, resourceId: id } });
      if (hasHistory) await this.resources.update({ id, tenantId }, { zoneId: null, active: false });
      else await this.resources.delete({ id, tenantId });
    }
    return (await this.listZones(tenantId, zone.locationId)).find((z) => z.id === zoneId);
  }

  /* ---------- живой план ---------- */

  /**
   * Состояние всех столов локации на момент `at`: текущая/ближайшая бронь, открытый счёт.
   * free — свободен; soon — бронь в ближайшие 90 мин; reserved — бронь идёт, гость не пришёл;
   * seated — гости за столом; billed — выставлен счёт; inactive — стол выключен.
   */
  async floorState(tenantId: string, locationId: string, atIso?: string) {
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const tz = safeTimeZone(project.timezone);
    const at = atIso ? new Date(atIso) : new Date();
    if (Number.isNaN(at.getTime())) throw new BadRequestException('Некорректное время');
    const ymd = zonedParts(at, tz).ymd;
    const dayStart = zonedToUtc(ymd, '00:00', tz);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);

    const zones = await this.listZones(tenantId, locationId);
    const tables = zones.flatMap((z) => z.tables);
    const tableIds = tables.map((t) => t.id);
    const dayReservations = await this.reservationsRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId AND r.locationId = :locationId', { tenantId, locationId })
      .andWhere('r.startAt < :dayEnd AND r.endAt > :dayStart', { dayStart, dayEnd })
      .andWhere('r.status NOT IN (:...st)', { st: ['cancelled_by_customer', 'cancelled_by_business', 'rejected', 'draft'] })
      .orderBy('r.startAt', 'ASC')
      .getMany();
    const openOrders = await this.orders.openByResource(tenantId, tableIds);
    const soonMs = 90 * 60_000;

    const tableStates = tables.map((t) => {
      const res = dayReservations.filter((r) => r.resourceId === t.id);
      const open = res.filter((r) => RESERVATION_ACTIVE_STATUSES.includes(r.status));
      const seated = open.find((r) => r.status === 'checked_in' || r.status === 'in_progress');
      const current = seated || open.find((r) => r.startAt <= at && r.endAt > at);
      const next = open.find((r) => r.startAt > at && r !== current);
      const order = openOrders.find((o) => o.resourceId === t.id) || null;
      let state: FloorTableState = 'free';
      if (!t.active) state = 'inactive';
      else if (order?.status === 'billed') state = 'billed';
      else if (seated || order) state = 'seated';
      else if (current) state = 'reserved';
      else if (next && next.startAt.getTime() - at.getTime() <= soonMs) state = 'soon';
      return {
        tableId: t.id,
        state,
        current: current || null,
        next: next || null,
        order: order ? { id: order.id, number: order.number, status: order.status, total: order.total, currency: order.currency, guests: order.guests, createdAt: order.createdAt } : null,
        reservationsToday: res.length,
        timeline: res.map((r) => ({ id: r.id, startAt: r.startAt, endAt: r.endAt, status: r.status, customerName: r.customerName, participants: r.participants })),
      };
    });

    const unseated = dayReservations.filter((r) => !r.resourceId && RESERVATION_ACTIVE_STATUSES.includes(r.status));
    const guestsNow = tableStates.reduce((s, ts) => s + (ts.state === 'seated' || ts.state === 'billed' ? ts.order?.guests || ts.current?.participants || 0 : 0), 0);
    const seatsTotal = tables.filter((t) => t.active).reduce((s, t) => s + (t.capacity || 0), 0);
    return {
      at,
      date: ymd,
      zones,
      tables: tableStates,
      unseated,
      stats: {
        tables: tables.filter((t) => t.active).length,
        free: tableStates.filter((s) => s.state === 'free').length,
        occupied: tableStates.filter((s) => s.state === 'seated' || s.state === 'billed').length,
        reserved: tableStates.filter((s) => s.state === 'reserved' || s.state === 'soon').length,
        guestsNow,
        seatsTotal,
        reservationsToday: dayReservations.length,
        guestsToday: dayReservations.reduce((s, r) => s + (r.participants || 0), 0),
      },
    };
  }

  /** Подбор столов под компанию: подходят по вместимости и свободны в окно брони. */
  async suggestTables(tenantId: string, locationId: string, startIso: string, endIso: string, guests: number) {
    const startAt = new Date(startIso);
    const endAt = new Date(endIso);
    if (!(startAt < endAt)) throw new BadRequestException('Некорректное время');
    const tables = await this.resources.find({ where: { tenantId, locationId, type: 'table', active: true } });
    const zones = await this.zones.find({ where: { tenantId, locationId } });
    const out: Array<{ table: BookingResource; zoneName: string | null; fit: number }> = [];
    for (const t of tables) {
      if ((t.capacity || 0) < guests) continue;
      if (t.minCapacity && guests < t.minCapacity) continue;
      const c = await this.availability.checkConflict({ tenantId, resourceId: t.id, startAt, endAt });
      if (!c.ok) continue;
      out.push({ table: t, zoneName: zones.find((z) => z.id === t.zoneId)?.name || null, fit: (t.capacity || 0) - guests });
    }
    out.sort((a, b) => a.fit - b.fit || a.table.name.localeCompare(b.table.name, 'ru', { numeric: true }));
    return out.map((o) => ({ id: o.table.id, name: o.table.name, capacity: o.table.capacity, zoneName: o.zoneName, shape: o.table.shape }));
  }

  /** Посадить гостей: существующую бронь (назначив стол) или «с улицы» — и открыть счёт стола. */
  async seat(
    tenantId: string,
    tableId: string,
    dto: { reservationId?: string; guests?: number; customerName?: string; customerPhone?: string; durationMinutes?: number },
    actingStaffUserId: string | null,
  ) {
    const table = await this.resources.findOne({ where: { id: tableId, tenantId } });
    if (!table) throw new NotFoundException('Стол не найден');
    if (!table.active) throw new BadRequestException('Стол выключен');
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const existingOrder = (await this.orders.openByResource(tenantId, [tableId]))[0];
    if (existingOrder) throw new BadRequestException(`За столом уже открыт счёт #${existingOrder.number}`);

    let reservation: Reservation;
    if (dto.reservationId) {
      reservation = await this.reservations.findOne(tenantId, dto.reservationId);
      if (reservation.resourceId !== tableId) {
        reservation = await this.reservations.update(tenantId, reservation.id, { resourceId: tableId } as any, actingStaffUserId);
      }
      if (dto.guests && dto.guests !== reservation.participants) {
        reservation = await this.reservations.update(tenantId, reservation.id, { participants: dto.guests } as any, actingStaffUserId);
      }
      reservation = await this.reservations.checkIn(tenantId, reservation.id, actingStaffUserId);
    } else {
      const now = new Date();
      const minutes = clampInt(dto.durationMinutes ?? project.verticalSettings?.turnMinutes ?? 120, 15, 720, 120);
      reservation = await this.reservations.create(
        tenantId,
        {
          locationId: table.locationId,
          resourceId: tableId,
          startAt: now.toISOString(),
          endAt: new Date(now.getTime() + minutes * 60_000).toISOString(),
          participants: Math.max(1, Number(dto.guests) || 2),
          customerName: dto.customerName?.trim() || 'Гость',
          customerPhone: dto.customerPhone?.trim() || undefined,
          source: 'walkin',
        },
        actingStaffUserId,
      );
      reservation = await this.reservations.checkIn(tenantId, reservation.id, actingStaffUserId);
    }
    const order = await this.orders.create(
      tenantId,
      { kind: 'table', reservationId: reservation.id, resourceId: tableId, guests: reservation.participants, prefillFromReservation: false },
      actingStaffUserId,
    );
    return { reservation, order };
  }

  /** Освободить стол: бронь завершается. Неоплаченный счёт не даём «потерять». */
  async release(tenantId: string, tableId: string, actingStaffUserId: string | null) {
    const order = (await this.orders.openByResource(tenantId, [tableId]))[0];
    if (order) throw new BadRequestException(`Счёт #${order.number} не оплачен — закройте или отмените его`);
    const seated = await this.reservationsRepo.find({
      where: { tenantId, resourceId: tableId, status: In(['checked_in', 'in_progress']) },
    });
    for (const r of seated) await this.reservations.complete(tenantId, r.id, actingStaffUserId);
    return { released: seated.length };
  }

  /** Пересадить гостей за другой стол (вместе с открытым счётом). */
  async move(tenantId: string, fromTableId: string, toTableId: string, actingStaffUserId: string | null) {
    if (fromTableId === toTableId) throw new BadRequestException('Это тот же стол');
    const to = await this.resources.findOne({ where: { id: toTableId, tenantId } });
    if (!to || !to.active) throw new BadRequestException('Целевой стол недоступен');
    const busy = (await this.orders.openByResource(tenantId, [toTableId]))[0];
    if (busy) throw new BadRequestException(`За столом «${to.name}» открыт счёт #${busy.number}`);
    const seated = await this.reservationsRepo.find({ where: { tenantId, resourceId: fromTableId, status: In(['checked_in', 'in_progress']) } });
    for (const r of seated) await this.reservations.update(tenantId, r.id, { resourceId: toTableId } as any, actingStaffUserId);
    const order = (await this.orders.openByResource(tenantId, [fromTableId]))[0];
    if (order) await this.orders.update(tenantId, order.id, { resourceId: toTableId } as any);
    return { moved: seated.length };
  }

  /* ---------- меню ---------- */

  async getMenu(tenantId: string) {
    const [categories, items] = await Promise.all([
      this.categories.find({ where: { tenantId }, order: { sortOrder: 'ASC', createdAt: 'ASC' } }),
      this.menuItems.find({ where: { tenantId }, order: { sortOrder: 'ASC', name: 'ASC' } }),
    ]);
    return { categories, items };
  }

  async createCategory(tenantId: string, dto: Partial<BookingMenuCategory>) {
    if (!dto.name?.trim()) throw new BadRequestException('Укажите название раздела');
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const count = await this.categories.count({ where: { tenantId } });
    return this.categories.save(this.categories.create({ tenantId, projectId: project.id, name: dto.name.trim(), sortOrder: count }));
  }

  async updateCategory(tenantId: string, id: string, dto: Partial<BookingMenuCategory>) {
    const c = await this.categories.findOne({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Раздел не найден');
    if (dto.name !== undefined) c.name = String(dto.name).trim() || c.name;
    if (dto.sortOrder !== undefined) c.sortOrder = clampInt(dto.sortOrder, 0, 10000, c.sortOrder);
    if (dto.active !== undefined) c.active = !!dto.active;
    return this.categories.save(c);
  }

  async reorderCategories(tenantId: string, ids: string[]) {
    for (let i = 0; i < ids.length; i++) await this.categories.update({ id: ids[i], tenantId }, { sortOrder: i });
    return this.getMenu(tenantId);
  }

  async deleteCategory(tenantId: string, id: string) {
    await this.menuItems.update({ tenantId, categoryId: id }, { categoryId: null });
    await this.categories.delete({ id, tenantId });
    return { ok: true };
  }

  private sanitizeItem(dto: Partial<BookingMenuItem>, base: Partial<BookingMenuItem>) {
    const out: Partial<BookingMenuItem> = {};
    if (dto.name !== undefined) out.name = String(dto.name).trim().slice(0, 255);
    if (dto.description !== undefined) out.description = dto.description ? String(dto.description).slice(0, 2000) : null;
    if (dto.categoryId !== undefined) out.categoryId = dto.categoryId || null;
    if (dto.price !== undefined) {
      const p = Number(dto.price);
      if (!Number.isFinite(p) || p < 0) throw new BadRequestException('Некорректная цена');
      out.price = String(Math.round(p * 100) / 100);
    }
    if (dto.currency !== undefined) out.currency = String(dto.currency || base.currency || 'RUB').toUpperCase().slice(0, 3);
    if (dto.portion !== undefined) out.portion = dto.portion ? String(dto.portion).slice(0, 60) : null;
    if (dto.tags !== undefined) out.tags = Array.isArray(dto.tags) ? dto.tags.map((t) => String(t).slice(0, 32)).slice(0, 12) : [];
    if (dto.imageUrl !== undefined) out.imageUrl = dto.imageUrl ? String(dto.imageUrl).slice(0, 1000) : null;
    if (dto.prepMinutes !== undefined) out.prepMinutes = dto.prepMinutes != null && (dto.prepMinutes as any) !== '' ? clampInt(dto.prepMinutes, 0, 600, 0) : null;
    if (dto.available !== undefined) out.available = !!dto.available;
    if (dto.active !== undefined) out.active = !!dto.active;
    if (dto.sortOrder !== undefined) out.sortOrder = clampInt(dto.sortOrder, 0, 100000, 0);
    return out;
  }

  async createMenuItem(tenantId: string, dto: Partial<BookingMenuItem>) {
    if (!dto.name?.trim()) throw new BadRequestException('Укажите название блюда');
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    if (dto.categoryId && !(await this.categories.exists({ where: { id: dto.categoryId, tenantId } }))) {
      throw new BadRequestException('Раздел меню не найден');
    }
    const fields = this.sanitizeItem({ currency: project.currency, ...dto }, { currency: project.currency });
    return this.menuItems.save(this.menuItems.create({ ...fields, tenantId, projectId: project.id }));
  }

  async updateMenuItem(tenantId: string, id: string, dto: Partial<BookingMenuItem>) {
    const item = await this.menuItems.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Позиция не найдена');
    if (dto.categoryId && !(await this.categories.exists({ where: { id: dto.categoryId, tenantId } }))) {
      throw new BadRequestException('Раздел меню не найден');
    }
    Object.assign(item, this.sanitizeItem(dto, item));
    return this.menuItems.save(item);
  }

  async deleteMenuItem(tenantId: string, id: string) {
    await this.menuItems.delete({ id, tenantId });
    return { ok: true };
  }
}
