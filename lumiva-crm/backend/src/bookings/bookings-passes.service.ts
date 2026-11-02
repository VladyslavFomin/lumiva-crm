import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BookingOrder } from './booking-order.entity';
import { BookingPassPlan } from './booking-pass-plan.entity';
import { BookingPass } from './booking-pass.entity';
import { BookingService } from './booking-service.entity';
import { Reservation } from './reservation.entity';
import { BookingsProjectsService } from './bookings-projects.service';
import { ReservationsService } from './reservations.service';
import { BookingsOrdersService } from './bookings-orders.service';
import { BookingsPassLedgerService, todayYmd } from './bookings-pass-ledger.service';
import { BookingOrderPaymentMethod } from './booking-order.entity';
import { YMD_RE, addDaysYmd } from './booking-time.util';

const daysBetween = (a: string, b: string) =>
  Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400_000);

/** Абонементы (фитнес) и пакеты сессий (консультации, салон): тарифы, продажа, заморозка, история. */
@Injectable()
export class BookingsPassesService {
  constructor(
    @InjectRepository(BookingPassPlan) private readonly plans: Repository<BookingPassPlan>,
    @InjectRepository(BookingPass) private readonly passes: Repository<BookingPass>,
    @InjectRepository(BookingService) private readonly services: Repository<BookingService>,
    @InjectRepository(Reservation) private readonly reservationsRepo: Repository<Reservation>,
    @InjectRepository(BookingOrder) private readonly orderRepo: Repository<BookingOrder>,
    private readonly projects: BookingsProjectsService,
    private readonly reservations: ReservationsService,
    private readonly orders: BookingsOrdersService,
    private readonly ledger: BookingsPassLedgerService,
  ) {}

  /* ---------- тарифы ---------- */

  listPlans(tenantId: string) {
    return this.plans.find({ where: { tenantId }, order: { active: 'DESC', price: 'ASC' } });
  }

  private async sanitizePlan(tenantId: string, dto: Partial<BookingPassPlan>, base?: BookingPassPlan) {
    const out: Partial<BookingPassPlan> = {};
    if (dto.name !== undefined) {
      if (!String(dto.name).trim()) throw new BadRequestException('Укажите название тарифа');
      out.name = String(dto.name).trim().slice(0, 255);
    }
    if (dto.description !== undefined) out.description = dto.description || null;
    if (dto.kind !== undefined) out.kind = dto.kind === 'unlimited' ? 'unlimited' : 'visits';
    const kind = out.kind || base?.kind || 'visits';
    if (dto.visits !== undefined || dto.kind !== undefined) {
      const v = Number(dto.visits ?? base?.visits);
      if (kind === 'visits' && (!Number.isInteger(v) || v < 1 || v > 1000)) throw new BadRequestException('Количество посещений — от 1 до 1000');
      out.visits = kind === 'visits' ? v : null;
    }
    if (dto.validityDays !== undefined) {
      const d = Number(dto.validityDays);
      if (!Number.isInteger(d) || d < 1 || d > 3650) throw new BadRequestException('Срок действия — от 1 до 3650 дней');
      out.validityDays = d;
    }
    if (dto.price !== undefined) {
      const p = Number(dto.price);
      if (!Number.isFinite(p) || p < 0) throw new BadRequestException('Некорректная цена');
      out.price = String(Math.round(p * 100) / 100);
    }
    if (dto.currency !== undefined) out.currency = String(dto.currency).toUpperCase().slice(0, 3);
    if (dto.serviceIds !== undefined) {
      const ids = Array.isArray(dto.serviceIds) ? dto.serviceIds : [];
      for (const id of ids) {
        if (!(await this.services.exists({ where: { id, tenantId } }))) throw new BadRequestException('Услуга/направление не найдено');
      }
      out.serviceIds = ids;
    }
    if (dto.freezeDaysAllowed !== undefined) out.freezeDaysAllowed = Math.min(365, Math.max(0, Number(dto.freezeDaysAllowed) || 0));
    if (dto.color !== undefined) out.color = dto.color || null;
    if (dto.active !== undefined) out.active = !!dto.active;
    return out;
  }

  async createPlan(tenantId: string, dto: Partial<BookingPassPlan>) {
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const fields = await this.sanitizePlan(tenantId, { currency: project.currency, kind: 'visits', visits: 8, validityDays: 30, ...dto });
    return this.plans.save(this.plans.create({ ...fields, tenantId, projectId: project.id }));
  }

  async updatePlan(tenantId: string, id: string, dto: Partial<BookingPassPlan>) {
    const plan = await this.plans.findOne({ where: { id, tenantId } });
    if (!plan) throw new NotFoundException('Тариф не найден');
    Object.assign(plan, await this.sanitizePlan(tenantId, dto, plan));
    return this.plans.save(plan);
  }

  async deletePlan(tenantId: string, id: string) {
    const sold = await this.passes.count({ where: { tenantId, planId: id } });
    // проданные абонементы ссылаются на тариф — такой тариф только архивируем
    if (sold) {
      await this.plans.update({ id, tenantId }, { active: false });
      return { archived: true };
    }
    await this.plans.delete({ id, tenantId });
    return { deleted: true };
  }

  /* ---------- абонементы клиентов ---------- */

  async list(tenantId: string, f: { status?: string; search?: string; contactId?: string; planId?: string }) {
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const today = todayYmd(project.timezone);
    const qb = this.passes.createQueryBuilder('p').where('p.tenantId = :tenantId', { tenantId }).orderBy('p.createdAt', 'DESC').take(1000);
    if (f.contactId) qb.andWhere('p.contactId = :c', { c: f.contactId });
    if (f.planId) qb.andWhere('p.planId = :pl', { pl: f.planId });
    if (f.search) {
      const n = Number(f.search.replace('№', '').trim());
      if (Number.isInteger(n) && n > 0) qb.andWhere('(p.number = :n OR p.customerName ILIKE :s)', { n, s: `%${f.search}%` });
      else qb.andWhere('(p.customerName ILIKE :s OR p.customerPhone ILIKE :s OR p.customerEmail ILIKE :s)', { s: `%${f.search}%` });
    }
    const rows = await qb.getMany();
    // ленивая актуализация статусов (истёк / израсходован) без отдельного крона
    for (const p of rows) {
      const before = p.status;
      this.ledger.normalize(p, today);
      if (p.status !== before) await this.passes.update({ id: p.id, tenantId }, { status: p.status });
    }
    const orderIds = rows.map((r) => r.orderId).filter(Boolean) as string[];
    const orderStatus = new Map<string, string>();
    if (orderIds.length) {
      // догоняем онлайн-оплаты выставленных счетов (статус приходит вебхуком в Payments)
      await this.orders.list(tenantId, { status: 'billed', kind: 'pass' }).catch(() => undefined);
      for (const o of await this.orderRepo.find({ where: { tenantId, id: In(orderIds) }, select: ['id', 'status'] })) orderStatus.set(o.id, o.status);
    }
    const out = rows.map((p) => ({ ...p, remaining: p.kind === 'visits' && p.visitsTotal != null ? Math.max(0, p.visitsTotal - p.visitsUsed) : null, paymentStatus: p.orderId ? orderStatus.get(p.orderId) || null : null }));
    return f.status ? out.filter((p) => f.status!.split(',').includes(p.status)) : out;
  }

  async get(tenantId: string, id: string) {
    const p = await this.passes.findOne({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Абонемент не найден');
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    this.ledger.normalize(p, todayYmd(project.timezone));
    const usage = await this.reservationsRepo.find({ where: { tenantId, passId: id }, order: { startAt: 'DESC' } });
    const order = p.orderId ? await this.orders.get(tenantId, p.orderId).catch(() => null) : null;
    return { ...p, remaining: p.kind === 'visits' && p.visitsTotal != null ? Math.max(0, p.visitsTotal - p.visitsUsed) : null, usage, order };
  }

  /** Продажа абонемента: создаём абонемент + счёт (сразу оплаченный, если указан способ). */
  async sell(
    tenantId: string,
    dto: { planId: string; customerName?: string; customerPhone?: string; customerEmail?: string; startsAt?: string; paymentMethod?: BookingOrderPaymentMethod | null; notes?: string; price?: number | string },
    actingStaffUserId: string | null,
  ) {
    const plan = await this.plans.findOne({ where: { id: dto.planId, tenantId } });
    if (!plan) throw new BadRequestException('Тариф не найден');
    if (!plan.active) throw new BadRequestException('Тариф в архиве');
    if (!dto.customerName?.trim() && !dto.customerPhone?.trim() && !dto.customerEmail?.trim()) throw new BadRequestException('Укажите клиента');
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const startsAt = dto.startsAt && YMD_RE.test(dto.startsAt) ? dto.startsAt : todayYmd(project.timezone);
    const { leadId, contactId } = await this.reservations.resolveLeadAndContact(tenantId, { name: dto.customerName, phone: dto.customerPhone, email: dto.customerEmail });
    const price = dto.price !== undefined && dto.price !== '' ? Math.max(0, Number(dto.price) || 0) : Number(plan.price);
    let pass: BookingPass | null = null;
    for (let attempt = 0; attempt < 5 && !pass; attempt++) {
      const row = await this.passes.createQueryBuilder('p').select('COALESCE(MAX(p.number), 0)', 'max').where('p.tenantId = :tenantId', { tenantId }).getRawOne<{ max: string }>();
      try {
        pass = await this.passes.save(
          this.passes.create({
            tenantId,
            projectId: project.id,
            planId: plan.id,
            number: Number(row?.max || 0) + 1,
            contactId,
            leadId,
            customerName: dto.customerName?.trim() || null,
            customerPhone: dto.customerPhone?.trim() || null,
            customerEmail: dto.customerEmail?.trim() || null,
            planName: plan.name,
            kind: plan.kind,
            visitsTotal: plan.kind === 'visits' ? plan.visits : null,
            visitsUsed: 0,
            serviceIds: plan.serviceIds || [],
            startsAt,
            expiresAt: addDaysYmd(startsAt, Math.max(1, plan.validityDays) - 1),
            status: 'active',
            freezeDaysAllowed: plan.freezeDaysAllowed,
            price: String(price),
            currency: plan.currency,
            notes: dto.notes || null,
          }),
        );
      } catch (e: any) {
        if (e?.code !== '23505') throw e;
      }
    }
    if (!pass) throw new BadRequestException('Не удалось присвоить номер абонементу');

    if (price > 0) {
      const order = await this.orders.create(
        tenantId,
        { kind: 'pass', passId: pass.id, contactId, leadId, customerName: pass.customerName, customerPhone: pass.customerPhone, customerEmail: pass.customerEmail, currency: plan.currency },
        actingStaffUserId,
      );
      await this.orders.addItem(tenantId, order.id, { kind: 'pass', refId: plan.id, name: `${project.businessType === 'consultation' ? 'Пакет' : 'Абонемент'} №${pass.number} · ${plan.name}`, unitPrice: price, qty: 1 });
      if (dto.paymentMethod) await this.orders.pay(tenantId, order.id, { method: dto.paymentMethod });
      pass.orderId = order.id;
      await this.passes.save(pass);
    }
    return this.get(tenantId, pass.id);
  }

  async freeze(tenantId: string, id: string, dto: { from?: string }) {
    const p = await this.passes.findOne({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Абонемент не найден');
    if (p.status !== 'active') throw new BadRequestException('Заморозить можно только активный абонемент');
    const left = p.freezeDaysAllowed - p.freezeDaysUsed;
    if (left <= 0) throw new BadRequestException('Лимит заморозки по тарифу исчерпан');
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    p.frozenFrom = dto.from && YMD_RE.test(dto.from) ? dto.from : todayYmd(project.timezone);
    p.status = 'frozen';
    return this.passes.save(p);
  }

  /** Разморозка: срок продлевается на фактические дни заморозки (не больше остатка лимита). */
  async unfreeze(tenantId: string, id: string) {
    const p = await this.passes.findOne({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Абонемент не найден');
    if (p.status !== 'frozen' || !p.frozenFrom) throw new BadRequestException('Абонемент не заморожен');
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const today = todayYmd(project.timezone);
    const days = Math.min(Math.max(0, daysBetween(p.frozenFrom, today)), p.freezeDaysAllowed - p.freezeDaysUsed);
    p.expiresAt = addDaysYmd(p.expiresAt, days);
    p.freezeDaysUsed += days;
    p.frozenFrom = null;
    p.status = 'active';
    this.ledger.normalize(p, today);
    return this.passes.save(p);
  }

  /** Ручная корректировка (подарок посещения / продление / исправление ошибки). */
  async adjust(tenantId: string, id: string, dto: { visitsDelta?: number; extendDays?: number; notes?: string }) {
    const p = await this.passes.findOne({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Абонемент не найден');
    if (p.status === 'cancelled') throw new BadRequestException('Абонемент отменён');
    if (dto.visitsDelta && p.kind === 'visits' && p.visitsTotal != null) {
      p.visitsTotal = Math.max(p.visitsUsed, p.visitsTotal + Math.round(dto.visitsDelta));
    }
    if (dto.extendDays) p.expiresAt = addDaysYmd(p.expiresAt, Math.round(dto.extendDays));
    if (dto.notes !== undefined) p.notes = dto.notes || null;
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    if (p.status !== 'frozen') this.ledger.normalize(p, todayYmd(project.timezone));
    return this.passes.save(p);
  }

  async cancel(tenantId: string, id: string) {
    const p = await this.passes.findOne({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Абонемент не найден');
    if (p.orderId) {
      const order = await this.orders.get(tenantId, p.orderId).catch(() => null);
      if (order && order.status !== 'paid' && order.status !== 'cancelled') await this.orders.cancel(tenantId, order.id);
    }
    p.status = 'cancelled';
    return this.passes.save(p);
  }

  /** Активные абонементы клиента, подходящие для услуги, — для выбора при записи. */
  async usableFor(tenantId: string, contactId: string, serviceId?: string) {
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const today = todayYmd(project.timezone);
    const rows = await this.passes.find({ where: { tenantId, contactId }, order: { expiresAt: 'ASC' } });
    return rows.filter((p) => this.ledger.isUsableFor(this.ledger.normalize(p, today), serviceId || null, today));
  }

  async stats(tenantId: string) {
    const list = await this.list(tenantId, {});
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const today = todayYmd(project.timezone);
    const soon = addDaysYmd(today, 7);
    return {
      active: list.filter((p) => p.status === 'active').length,
      frozen: list.filter((p) => p.status === 'frozen').length,
      expiringSoon: list.filter((p) => p.status === 'active' && p.expiresAt <= soon).length,
      lowVisits: list.filter((p) => p.status === 'active' && p.remaining != null && p.remaining <= 1).length,
      unpaid: list.filter((p) => p.paymentStatus && p.paymentStatus !== 'paid' && p.paymentStatus !== 'cancelled' && p.status !== 'cancelled').length,
    };
  }
}
