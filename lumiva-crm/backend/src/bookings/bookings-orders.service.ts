import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BookingOrder, BookingOrderKind, BookingOrderPaymentMethod } from './booking-order.entity';
import { BookingOrderItem, BookingOrderItemKind, BookingOrderItemStatus } from './booking-order-item.entity';
import { BookingMenuItem } from './booking-menu-item.entity';
import { BookingService } from './booking-service.entity';
import { BookingResource } from './booking-resource.entity';
import { Reservation } from './reservation.entity';
import { BookingsProjectsService } from './bookings-projects.service';
import { Payment } from '../payments/payment.entity';
import { PaymentsService } from '../payments/payments.service';
import type { PaymentProvider } from '../payments/payment.entity';

const money = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export interface OrderListFilters {
  status?: string;
  kind?: string;
  from?: string;
  to?: string;
  locationId?: string;
  resourceId?: string;
  reservationId?: string;
  search?: string;
}

export interface OrderWithItems extends BookingOrder {
  items: BookingOrderItem[];
}

export interface CreateOrderInput {
  kind?: BookingOrderKind;
  reservationId?: string | null;
  resourceId?: string | null;
  locationId?: string | null;
  passId?: string | null;
  guests?: number;
  staffUserId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  contactId?: string | null;
  leadId?: string | null;
  currency?: string;
  notes?: string | null;
  /** Сразу добавить строку услуги из брони (салон/консультации). */
  prefillFromReservation?: boolean;
}

export interface AddOrderItemInput {
  kind: BookingOrderItemKind;
  refId?: string | null;
  name?: string;
  unitPrice?: number | string;
  qty?: number | string;
  note?: string | null;
  course?: number | null;
}

/**
 * Счета/заказы для всех вертикалей бронирования. Цены позиций меню/услуг берутся только на
 * сервере (клиент присылает refId), итоги всегда пересчитываются здесь — клиент не может
 * «нарисовать» сумму счёта.
 */
@Injectable()
export class BookingsOrdersService {
  constructor(
    @InjectRepository(BookingOrder) private readonly orders: Repository<BookingOrder>,
    @InjectRepository(BookingOrderItem) private readonly items: Repository<BookingOrderItem>,
    @InjectRepository(BookingMenuItem) private readonly menu: Repository<BookingMenuItem>,
    @InjectRepository(BookingService) private readonly services: Repository<BookingService>,
    @InjectRepository(BookingResource) private readonly resources: Repository<BookingResource>,
    @InjectRepository(Reservation) private readonly reservations: Repository<Reservation>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    private readonly projects: BookingsProjectsService,
    private readonly paymentsService: PaymentsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /** SalesService лениво: SalesModule → AutomationsModule → BookingsModule — цикл DI. */
  private async sales(): Promise<any> {
    const { SalesService } = await import('../sales/sales.service.js');
    return this.moduleRef.get(SalesService, { strict: false });
  }

  private async nextNumber(tenantId: string): Promise<number> {
    const row = await this.orders
      .createQueryBuilder('o')
      .select('COALESCE(MAX(o.number), 1000)', 'max')
      .where('o.tenantId = :tenantId', { tenantId })
      .getRawOne<{ max: string }>();
    return Number(row?.max || 1000) + 1;
  }

  /* ---------- чтение ---------- */

  async list(tenantId: string, f: OrderListFilters): Promise<Array<BookingOrder & { itemsCount: number }>> {
    const qb = this.orders.createQueryBuilder('o').where('o.tenantId = :tenantId', { tenantId }).orderBy('o.createdAt', 'DESC').take(500);
    if (f.status) qb.andWhere('o.status IN (:...st)', { st: f.status.split(',') });
    if (f.kind) qb.andWhere('o.kind IN (:...kinds)', { kinds: f.kind.split(',') });
    if (f.locationId) qb.andWhere('o.locationId = :loc', { loc: f.locationId });
    if (f.resourceId) qb.andWhere('o.resourceId = :res', { res: f.resourceId });
    if (f.reservationId) qb.andWhere('o.reservationId = :rid', { rid: f.reservationId });
    if (f.from) qb.andWhere('o.createdAt >= :from', { from: new Date(f.from) });
    if (f.to) {
      const to = /^\d{4}-\d{2}-\d{2}$/.test(f.to) ? new Date(`${f.to}T23:59:59.999Z`) : new Date(f.to);
      qb.andWhere('o.createdAt <= :to', { to });
    }
    if (f.search) {
      const n = Number(f.search.replace('#', ''));
      if (Number.isInteger(n) && n > 0) qb.andWhere('(o.number = :n OR o.customerName ILIKE :s)', { n, s: `%${f.search}%` });
      else qb.andWhere('(o.customerName ILIKE :s OR o.customerPhone ILIKE :s)', { s: `%${f.search}%` });
    }
    const rows = await qb.getMany();
    await this.syncOnlinePayments(tenantId, rows);
    const counts = rows.length
      ? await this.items
          .createQueryBuilder('i')
          .select('i.orderId', 'orderId')
          .addSelect('COUNT(*)', 'cnt')
          .where('i.tenantId = :tenantId AND i.orderId IN (:...ids) AND i.status != :void', { tenantId, ids: rows.map((r) => r.id), void: 'void' })
          .groupBy('i.orderId')
          .getRawMany<{ orderId: string; cnt: string }>()
      : [];
    const byId = new Map(counts.map((c) => [c.orderId, Number(c.cnt)]));
    return rows.map((r) => Object.assign(r, { itemsCount: byId.get(r.id) || 0 }));
  }

  async get(tenantId: string, id: string): Promise<OrderWithItems> {
    const order = await this.orders.findOne({ where: { id, tenantId } });
    if (!order) throw new NotFoundException('Счёт не найден');
    await this.syncOnlinePayments(tenantId, [order]);
    const items = await this.items.find({ where: { tenantId, orderId: id }, order: { createdAt: 'ASC' } });
    return Object.assign(order, { items });
  }

  /** Открытые/выставленные счета по столам/ресурсам (для живого плана зала). */
  async openByResource(tenantId: string, resourceIds: string[]): Promise<BookingOrder[]> {
    if (!resourceIds.length) return [];
    return this.orders.find({ where: { tenantId, resourceId: In(resourceIds), status: In(['open', 'billed']) } });
  }

  /**
   * Онлайн-оплата подтверждается вебхуком провайдера в PaymentsService (Payment → paid,
   * Sale → confirmed) — он про счета бронирования не знает. Догоняем статус лениво при
   * чтении: выставленный счёт с оплаченным Payment по его продаже считается оплаченным.
   */
  private async syncOnlinePayments(tenantId: string, rows: BookingOrder[]): Promise<void> {
    const pending = rows.filter((o) => o.status === 'billed' && o.saleId);
    if (!pending.length) return;
    const paid = await this.payments.find({
      where: { tenantId, saleId: In(pending.map((o) => o.saleId!)), status: 'paid' } as any,
    });
    for (const p of paid) {
      const order = pending.find((o) => o.saleId === p.saleId);
      if (!order || order.status === 'paid') continue;
      order.status = 'paid';
      order.paymentMethod = 'online';
      order.paidAmount = order.total;
      order.paidAt = p.paidAt || new Date();
      await this.orders.save(order);
      await this.afterPaid(tenantId, order);
    }
  }

  /* ---------- создание / изменение ---------- */

  async create(tenantId: string, dto: CreateOrderInput, actingStaffUserId: string | null): Promise<OrderWithItems> {
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    let reservation: Reservation | null = null;
    if (dto.reservationId) {
      reservation = await this.reservations.findOne({ where: { id: dto.reservationId, tenantId } });
      if (!reservation) throw new BadRequestException('Бронь не найдена');
      // Один активный счёт на бронь: повторное «Открыть счёт» возвращает существующий.
      const existing = await this.orders.findOne({ where: { tenantId, reservationId: reservation.id, status: In(['open', 'billed']) } });
      if (existing) return this.get(tenantId, existing.id);
    }
    if (dto.resourceId) {
      const exists = await this.resources.exists({ where: { id: dto.resourceId, tenantId } });
      if (!exists) throw new BadRequestException('Стол/ресурс не найден');
    }
    const defaultService = project.businessType === 'restaurant' ? project.verticalSettings?.serviceChargePercent || 0 : 0;

    let saved: BookingOrder | null = null;
    for (let attempt = 0; attempt < 5 && !saved; attempt++) {
      const order = this.orders.create({
        tenantId,
        projectId: project.id,
        number: await this.nextNumber(tenantId),
        kind: dto.kind || (reservation ? 'reservation' : 'walkin'),
        status: 'open',
        locationId: dto.locationId || reservation?.locationId || null,
        reservationId: reservation?.id || null,
        resourceId: dto.resourceId || reservation?.resourceId || null,
        passId: dto.passId || null,
        contactId: dto.contactId || reservation?.contactId || null,
        leadId: dto.leadId || reservation?.leadId || null,
        customerName: dto.customerName ?? reservation?.customerName ?? null,
        customerPhone: dto.customerPhone ?? reservation?.customerPhone ?? null,
        customerEmail: dto.customerEmail ?? reservation?.customerEmail ?? null,
        guests: Math.max(1, Number(dto.guests) || reservation?.participants || 1),
        staffUserId: dto.staffUserId || reservation?.staffUserId || null,
        currency: (dto.currency || reservation?.currency || project.currency || 'RUB').toUpperCase().slice(0, 3),
        serviceChargePercent: String(defaultService),
        notes: dto.notes || null,
        createdByStaffUserId: actingStaffUserId,
      });
      try {
        saved = await this.orders.save(order);
      } catch (e: any) {
        if (e?.code !== '23505') throw e; // гонка номера — пробуем следующий
      }
    }
    if (!saved) throw new BadRequestException('Не удалось присвоить номер счёту');

    if (reservation && dto.prefillFromReservation !== false && project.businessType !== 'restaurant') {
      if (reservation.serviceId) {
        const svc = await this.services.findOne({ where: { id: reservation.serviceId, tenantId } });
        if (svc) {
          const price = reservation.price != null ? num(reservation.price) : num(svc.price);
          await this.items.save(this.items.create({ tenantId, orderId: saved.id, kind: 'service', refId: svc.id, name: svc.name, unitPrice: String(price), qty: String(Math.max(1, reservation.participants || 1)) }));
        }
      } else if (reservation.resourceId && project.businessType === 'rental') {
        const res = await this.resources.findOne({ where: { id: reservation.resourceId, tenantId } });
        if (res) {
          const quote = this.quoteRental(res, reservation.startAt, reservation.endAt, reservation.units, project.verticalSettings?.rentalUnit);
          const unitPrice = reservation.price != null ? num(reservation.price) / Math.max(1, reservation.units) : quote.unitTotal;
          await this.items.save(this.items.create({ tenantId, orderId: saved.id, kind: 'rental', refId: res.id, name: `${res.name} · ${quote.label}`, unitPrice: String(money(unitPrice)), qty: String(reservation.units || 1) }));
        }
      } else if (reservation.price != null && num(reservation.price) > 0) {
        await this.items.save(this.items.create({ tenantId, orderId: saved.id, kind: 'custom', name: 'Бронь', unitPrice: String(num(reservation.price)), qty: '1' }));
      }
    }
    await this.recalc(tenantId, saved.id);
    return this.get(tenantId, saved.id);
  }

  /** Расчёт стоимости аренды: по часам или суткам (неполный период округляется вверх). */
  quoteRental(res: BookingResource, startAt: Date, endAt: Date, units = 1, preferred?: 'hour' | 'day') {
    // 5 минут допуска: «с 10:00 до 13:00», созданное в 10:00:20, — это 3 часа, а не 4
    const hours = Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime() - 5 * 60_000) / 3600_000));
    const days = Math.max(1, Math.ceil(hours / 24));
    const perHour = res.pricePerHour != null ? num(res.pricePerHour) : null;
    const perDay = res.pricePerDay != null ? num(res.pricePerDay) : null;
    let unitTotal = 0;
    let label = '';
    let mode: 'hour' | 'day' = preferred || (hours >= 24 ? 'day' : 'hour');
    if (mode === 'hour' && perHour == null && perDay != null) mode = 'day';
    if (mode === 'day' && perDay == null && perHour != null) mode = 'hour';
    if (mode === 'day' && perDay != null) {
      unitTotal = perDay * days;
      // если почасовая аренда дешевле суток (короткий прокат) — честно берём меньшую
      if (perHour != null && hours < 24) unitTotal = Math.min(unitTotal, perHour * hours);
      label = hours < 24 && perHour != null && perHour * hours < perDay * days ? `${hours} ч` : `${days} сут`;
    } else if (perHour != null) {
      unitTotal = perHour * hours;
      label = `${hours} ч`;
    }
    const u = Math.max(1, units || 1);
    return {
      hours,
      days,
      mode,
      label,
      unitTotal: money(unitTotal),
      total: money(unitTotal * u),
      deposit: money((res.depositAmount != null ? num(res.depositAmount) : 0) * u),
    };
  }

  private ensureEditable(order: BookingOrder) {
    if (order.status === 'paid') throw new BadRequestException('Счёт уже оплачен');
    if (order.status === 'cancelled') throw new BadRequestException('Счёт отменён');
  }

  async update(tenantId: string, id: string, dto: Partial<BookingOrder>): Promise<OrderWithItems> {
    const order = await this.get(tenantId, id);
    this.ensureEditable(order);
    const allowed: Array<keyof BookingOrder> = ['guests', 'staffUserId', 'notes', 'customerName', 'customerPhone', 'customerEmail', 'resourceId'];
    for (const k of allowed) if (dto[k] !== undefined) (order as any)[k] = dto[k];
    if (dto.discountPercent !== undefined) order.discountPercent = String(Math.min(100, Math.max(0, num(dto.discountPercent))));
    if (dto.serviceChargePercent !== undefined) order.serviceChargePercent = String(Math.min(100, Math.max(0, num(dto.serviceChargePercent))));
    if (dto.tipAmount !== undefined) order.tipAmount = String(Math.max(0, money(num(dto.tipAmount))));
    const { items: _i, ...plain } = order as any;
    await this.orders.save(plain);
    await this.recalc(tenantId, id);
    return this.get(tenantId, id);
  }

  async addItem(tenantId: string, orderId: string, dto: AddOrderItemInput): Promise<OrderWithItems> {
    const order = await this.get(tenantId, orderId);
    this.ensureEditable(order);
    const qty = Math.max(0.01, num(dto.qty ?? 1));
    let name = dto.name?.trim() || '';
    let unitPrice = num(dto.unitPrice);
    if (dto.kind === 'menu') {
      const mi = dto.refId ? await this.menu.findOne({ where: { id: dto.refId, tenantId } }) : null;
      if (!mi) throw new BadRequestException('Позиция меню не найдена');
      if (!mi.available || !mi.active) throw new BadRequestException(`«${mi.name}» в стоп-листе`);
      name = mi.name;
      unitPrice = num(mi.price);
      // одна и та же позиция без комментария и того же курса — увеличиваем количество
      const same = order.items.find((i) => i.kind === 'menu' && i.refId === mi.id && i.status === 'new' && !i.note && !dto.note && (i.course ?? null) === (dto.course ?? null));
      if (same) {
        same.qty = String(num(same.qty) + qty);
        await this.items.save(same);
        await this.recalc(tenantId, orderId);
        return this.get(tenantId, orderId);
      }
    } else if (dto.kind === 'service') {
      const svc = dto.refId ? await this.services.findOne({ where: { id: dto.refId, tenantId } }) : null;
      if (!svc) throw new BadRequestException('Услуга не найдена');
      name = svc.name;
      unitPrice = dto.unitPrice !== undefined && dto.unitPrice !== '' ? num(dto.unitPrice) : num(svc.price);
    } else if (!name) {
      throw new BadRequestException('Укажите название позиции');
    }
    if (unitPrice < 0 && dto.kind !== 'custom') throw new BadRequestException('Цена не может быть отрицательной');
    await this.items.save(
      this.items.create({
        tenantId,
        orderId,
        kind: dto.kind,
        refId: dto.refId || null,
        name,
        unitPrice: String(money(unitPrice)),
        qty: String(qty),
        note: dto.note || null,
        course: dto.course ?? null,
      }),
    );
    await this.recalc(tenantId, orderId);
    return this.get(tenantId, orderId);
  }

  async updateItem(
    tenantId: string,
    orderId: string,
    itemId: string,
    dto: { qty?: number | string; note?: string | null; status?: BookingOrderItemStatus; course?: number | null; unitPrice?: number | string },
  ): Promise<OrderWithItems> {
    const order = await this.get(tenantId, orderId);
    this.ensureEditable(order);
    const item = order.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Позиция не найдена');
    if (dto.qty !== undefined) item.qty = String(Math.max(0.01, num(dto.qty)));
    if (dto.note !== undefined) item.note = dto.note || null;
    if (dto.course !== undefined) item.course = dto.course;
    if (dto.status && ['new', 'cooking', 'served', 'void'].includes(dto.status)) item.status = dto.status;
    // цену можно править только у свободных строк — у меню/услуг она из справочника
    if (dto.unitPrice !== undefined && (item.kind === 'custom' || item.kind === 'fee')) item.unitPrice = String(money(num(dto.unitPrice)));
    await this.items.save(item);
    await this.recalc(tenantId, orderId);
    return this.get(tenantId, orderId);
  }

  async removeItem(tenantId: string, orderId: string, itemId: string): Promise<OrderWithItems> {
    const order = await this.get(tenantId, orderId);
    this.ensureEditable(order);
    const item = order.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Позиция не найдена');
    // уже готовящуюся/поданную позицию не удаляем бесследно — только «отмена» (void)
    if (item.status === 'cooking' || item.status === 'served') {
      item.status = 'void';
      await this.items.save(item);
    } else {
      await this.items.delete({ id: itemId, tenantId });
    }
    await this.recalc(tenantId, orderId);
    return this.get(tenantId, orderId);
  }

  async recalc(tenantId: string, orderId: string): Promise<void> {
    const order = await this.orders.findOne({ where: { id: orderId, tenantId } });
    if (!order) return;
    const items = await this.items.find({ where: { tenantId, orderId } });
    const subtotal = money(items.filter((i) => i.status !== 'void').reduce((s, i) => s + num(i.unitPrice) * num(i.qty), 0));
    const discount = money((subtotal * num(order.discountPercent)) / 100);
    const service = money(((subtotal - discount) * num(order.serviceChargePercent)) / 100);
    const total = money(subtotal - discount + service + num(order.tipAmount));
    await this.orders.update(
      { id: orderId, tenantId },
      { subtotal: String(subtotal), discountAmount: String(discount), serviceChargeAmount: String(service), total: String(Math.max(0, total)) },
    );
  }

  /* ---------- счёт / оплата ---------- */

  private async upsertSale(tenantId: string, order: OrderWithItems, paid: boolean): Promise<string> {
    const sales = await this.sales();
    const lines = order.items.filter((i) => i.status !== 'void').map((i) => ({ name: i.name, qty: num(i.qty), unitPrice: num(i.unitPrice) }));
    if (num(order.discountAmount) > 0) lines.push({ name: `Скидка ${num(order.discountPercent)}%`, qty: 1, unitPrice: -num(order.discountAmount) });
    if (num(order.serviceChargeAmount) > 0) lines.push({ name: `Сервисный сбор ${num(order.serviceChargePercent)}%`, qty: 1, unitPrice: num(order.serviceChargeAmount) });
    if (num(order.tipAmount) > 0) lines.push({ name: 'Чаевые', qty: 1, unitPrice: num(order.tipAmount) });
    const sale = await sales.upsertFromBooking(tenantId, {
      saleId: order.saleId,
      orderNo: `#${order.number}`,
      items: lines,
      amount: num(order.total),
      currency: order.currency,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      leadId: order.leadId,
      contactId: order.contactId,
      paid,
    });
    return sale.id;
  }

  async bill(tenantId: string, id: string): Promise<OrderWithItems> {
    const order = await this.get(tenantId, id);
    this.ensureEditable(order);
    if (!order.items.some((i) => i.status !== 'void')) throw new BadRequestException('В счёте нет позиций');
    order.saleId = await this.upsertSale(tenantId, order, false);
    order.status = 'billed';
    order.billedAt = new Date();
    const { items: _i, ...plain } = order as any;
    await this.orders.save(plain);
    if (order.reservationId) {
      await this.reservations.update({ id: order.reservationId, tenantId }, { paymentStatus: 'unpaid', price: order.total, currency: order.currency });
    }
    return this.get(tenantId, id);
  }

  /** Вернуть выставленный (но не оплаченный) счёт в работу — дозаказ после пречека. */
  async reopen(tenantId: string, id: string): Promise<OrderWithItems> {
    const order = await this.get(tenantId, id);
    if (order.status !== 'billed') throw new BadRequestException('Вернуть в работу можно только выставленный счёт');
    order.status = 'open';
    order.paymentUrl = null;
    const { items: _i, ...plain } = order as any;
    await this.orders.save(plain);
    return this.get(tenantId, id);
  }

  async pay(
    tenantId: string,
    id: string,
    dto: { method: BookingOrderPaymentMethod; amount?: number | string; tipAmount?: number | string },
  ): Promise<OrderWithItems> {
    let order = await this.get(tenantId, id);
    this.ensureEditable(order);
    if (!['cash', 'card', 'transfer', 'mixed', 'online'].includes(dto.method)) throw new BadRequestException('Неизвестный способ оплаты');
    if (dto.tipAmount !== undefined && num(dto.tipAmount) !== num(order.tipAmount)) {
      order = await this.update(tenantId, id, { tipAmount: String(dto.tipAmount) } as any);
    }
    if (!order.items.some((i) => i.status !== 'void')) throw new BadRequestException('В счёте нет позиций');
    const paidAmount = dto.amount !== undefined && dto.amount !== '' ? money(num(dto.amount)) : num(order.total);
    if (paidAmount + 0.001 < num(order.total)) throw new BadRequestException('Сумма оплаты меньше итога счёта');
    order.saleId = await this.upsertSale(tenantId, order, true);
    order.status = 'paid';
    order.paymentMethod = dto.method;
    order.paidAmount = String(paidAmount);
    order.paidAt = new Date();
    order.billedAt = order.billedAt || new Date();
    const { items: _i, ...plain } = order as any;
    await this.orders.save(plain);
    await this.afterPaid(tenantId, order);
    return this.get(tenantId, id);
  }

  /** Продажа к этому моменту уже подтверждена (pay → upsertSale(paid) / вебхук провайдера). */
  private async afterPaid(tenantId: string, order: BookingOrder): Promise<void> {
    if (order.reservationId) {
      await this.reservations.update({ id: order.reservationId, tenantId }, { paymentStatus: 'paid', price: order.total, currency: order.currency });
    }
  }

  async createPaymentLink(
    tenantId: string,
    id: string,
    dto: { buyerName?: string; buyerEmail?: string; buyerPhone?: string; city?: string; address?: string; provider?: PaymentProvider },
    ip: string,
  ): Promise<OrderWithItems> {
    let order = await this.get(tenantId, id);
    if (order.status === 'open') order = await this.bill(tenantId, id);
    if (order.status !== 'billed') throw new BadRequestException('Ссылку можно создать только для выставленного счёта');
    const provider = dto.provider || (await this.paymentsService.findEnabledProvider(tenantId));
    if (!provider) throw new BadRequestException('Не подключена ни одна платёжная система (Интеграции → iyzico / PayTR / ЮKassa)');
    const buyerEmail = dto.buyerEmail?.trim() || order.customerEmail || '';
    if (!buyerEmail) throw new BadRequestException('Для онлайн-оплаты нужен e-mail плательщика');
    const payment = await this.paymentsService.createSalePaymentLink(
      tenantId,
      order.saleId!,
      {
        buyerName: dto.buyerName?.trim() || order.customerName || 'Guest',
        buyerEmail,
        buyerPhone: dto.buyerPhone || order.customerPhone || undefined,
        city: dto.city?.trim() || '—',
        address: dto.address?.trim() || '—',
        provider,
      },
      ip,
    );
    await this.orders.update({ id, tenantId }, { paymentUrl: payment.paymentPageUrl || null });
    return this.get(tenantId, id);
  }

  async cancel(tenantId: string, id: string): Promise<OrderWithItems> {
    const order = await this.get(tenantId, id);
    if (order.status === 'paid') throw new BadRequestException('Оплаченный счёт нельзя отменить — оформите возврат в «Продажах»');
    if (order.saleId) {
      const sales = await this.sales();
      await sales.cancelBookingSale(tenantId, order.saleId).catch(() => undefined);
    }
    await this.orders.update({ id, tenantId }, { status: 'cancelled', paymentUrl: null });
    return this.get(tenantId, id);
  }

  /* ---------- сводка ---------- */

  async summary(tenantId: string, from: Date, to: Date) {
    const rows = await this.orders
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('o.currency', 'currency')
      .addSelect('COUNT(*)', 'cnt')
      .addSelect('COALESCE(SUM(o.total),0)', 'total')
      .addSelect('COALESCE(SUM(o.tipAmount),0)', 'tips')
      .addSelect('COALESCE(SUM(o.guests),0)', 'guests')
      .where('o.tenantId = :tenantId AND o.createdAt >= :from AND o.createdAt <= :to', { tenantId, from, to })
      .groupBy('o.status')
      .addGroupBy('o.currency')
      .getRawMany<{ status: string; currency: string; cnt: string; total: string; tips: string; guests: string }>();
    return rows.map((r) => ({ status: r.status, currency: r.currency, count: Number(r.cnt), total: money(num(r.total)), tips: money(num(r.tips)), guests: Number(r.guests) }));
  }

  /** Топ блюд за период (по оплаченным/выставленным счетам). */
  async topMenuItems(tenantId: string, from: Date, to: Date, limit = 10) {
    const rows = await this.items
      .createQueryBuilder('i')
      .innerJoin(BookingOrder, 'o', 'o.id = i.orderId')
      .select('i.refId', 'refId')
      .addSelect('MAX(i.name)', 'name')
      .addSelect('SUM(i.qty)', 'qty')
      .addSelect('SUM(i.qty * i.unitPrice)', 'revenue')
      .addSelect('MAX(o.currency)', 'currency')
      .where('i.tenantId = :tenantId AND i.kind = :kind AND i.status != :void', { tenantId, kind: 'menu', void: 'void' })
      .andWhere('o.status IN (:...st) AND o.createdAt >= :from AND o.createdAt <= :to', { st: ['billed', 'paid'], from, to })
      .groupBy('i.refId')
      .orderBy('SUM(i.qty)', 'DESC')
      .limit(limit)
      .getRawMany<{ refId: string; name: string; qty: string; revenue: string; currency: string }>();
    return rows.map((r) => ({ refId: r.refId, name: r.name, qty: num(r.qty), revenue: money(num(r.revenue)), currency: r.currency }));
  }
}
