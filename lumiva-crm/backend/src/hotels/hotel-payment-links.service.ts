import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { In, LessThan, Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelFolioKind } from './hotel-folio.entities';
import { HotelPaymentRequest, HotelPaymentRequestKind } from './hotel-payment-request.entity';
import { HotelFolioService } from './hotel-folio.service';
import { HotelReservationsService } from './hotel-reservations.service';
import { PaymentsService } from '../payments/payments.service';
import { Payment } from '../payments/payment.entity';
import { TenantMailService } from '../mail/tenant-mail.service';
import { tenantFrontend } from '../common/tenant-branding.util';
import { normalizeNumericInput } from './hotel-number.util';

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const bad = (code: string, message: string) => new BadRequestException({ code, message });
const esc = (v: string) => String(v || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));
const OPEN = ['pending', 'confirmed', 'checked_in'];
const DEFAULT_DAYS = 7;

/**
 * Онлайн-предоплата брони: запрос оплаты с постоянной ссылкой /hp/:token; по нажатию «Оплатить» — сессия у
 * подключённой платёжной системы (iyzico / PayTR / ЮKassa, PaymentsService). Оплата → платёж в фолио брони
 * способом «онлайн» (мимо кассовой смены). Зачисление идемпотентно: условный UPDATE статуса запроса; хук оплаты
 * плюс сверка раз в 2 минуты (если хук не дошёл).
 */
@Injectable()
export class HotelPaymentLinksService implements OnModuleInit {
  private readonly log = new Logger(HotelPaymentLinksService.name);

  constructor(
    @InjectRepository(HotelPaymentRequest) private readonly reqs: Repository<HotelPaymentRequest>,
    @InjectRepository(HotelReservation) private readonly reservations: Repository<HotelReservation>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelRoomType) private readonly roomTypes: Repository<HotelRoomType>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    private readonly folio: HotelFolioService,
    private readonly reservationsService: HotelReservationsService,
    private readonly paymentsService: PaymentsService,
    private readonly tenantMail: TenantMailService,
  ) {}

  onModuleInit() {
    this.paymentsService.onPaid(async (p) => {
      if (p.source === 'hotel_payment' && p.hotelPaymentRequestId) await this.applyPaid(p.hotelPaymentRequestId, p);
    });
  }

  private async url(tenantId: string, token: string) {
    return `${await tenantFrontend((sql, params) => this.reqs.manager.query(sql, params), tenantId)}/hp/${token}`;
  }

  private async reservation(tenantId: string, id: string) {
    const r = await this.reservations.findOne({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Бронь не найдена');
    return r;
  }

  /** Сколько можно попросить: неоплаченная предоплата (если есть), остаток счёта */
  async suggest(tenantId: string, reservationId: string) {
    const r = await this.reservation(tenantId, reservationId);
    const f = await this.folio.folio(tenantId, reservationId);
    const hotel = await this.hotels.findOne({ where: { id: r.hotelId, tenantId } });
    const paidGuest = f.summary.folios.guest.payments;
    const depositLeft = r2(Math.max(0, num(r.depositAmount) - paidGuest));
    const provider = await this.paymentsService.enabledProviderInfo(tenantId);
    const currency = (hotel?.currency || 'TRY').toUpperCase();
    return {
      currency,
      depositAmount: num(r.depositAmount),
      depositDueDate: r.depositDueDate,
      depositLeft,
      balance: { guest: f.summary.folios.guest.balance, partner: f.summary.folios.partner.balance },
      provider: provider?.provider ?? null,
      currencySupported: !!provider && provider.currencies.includes(currency),
      guestEmail: r.guestEmail,
      guestPhone: r.guestPhone,
    };
  }

  async create(
    tenantId: string,
    dto: { reservationId: string; amount?: number | string; folio?: string; kind?: string; expiresInDays?: number | string; note?: string; sendEmail?: boolean },
    actor: string | null,
    origin: 'staff' | 'website' = 'staff',
  ) {
    const r = await this.reservation(tenantId, dto?.reservationId);
    if (!OPEN.includes(r.status)) throw bad('HOTEL_PAY_CLOSED', 'Бронь отменена или закрыта — оплату не запросить');
    const s = await this.suggest(tenantId, r.id);
    if (!s.provider) throw bad('HOTEL_PAY_NO_PROVIDER', 'Платёжная система не подключена: подключите iyzico, PayTR или ЮKassa в «Интеграциях»');
    if (!s.currencySupported) throw bad('HOTEL_PAY_CURRENCY', `Платёжная система не принимает валюту отеля ${s.currency}`);
    const folio: HotelFolioKind = dto.folio === 'partner' ? 'partner' : 'guest';
    const kind: HotelPaymentRequestKind = dto.kind === 'deposit' || dto.kind === 'balance' ? dto.kind : 'custom';
    const fallback = kind === 'deposit' ? s.depositLeft : s.balance[folio];
    const amount = r2(dto.amount !== undefined && dto.amount !== null && String(dto.amount) !== '' ? num(normalizeNumericInput(dto.amount as any)) : fallback);
    if (!(amount > 0)) throw bad('HOTEL_PAY_AMOUNT', 'Сумма к оплате должна быть больше нуля');
    // больше остатка по счёту не просим — иначе гость переплатит
    if (amount > s.balance[folio] + 0.009) throw bad('HOTEL_PAY_TOO_MUCH', `Сумма больше остатка по счёту (${s.balance[folio]})`);
    const days = Math.min(60, Math.max(1, Math.round(num(dto.expiresInDays) || DEFAULT_DAYS)));
    const row = await this.reqs.save(this.reqs.create({
      tenantId, hotelId: r.hotelId, reservationId: r.id, token: randomBytes(24).toString('hex'), folio, kind, amount: String(amount), currency: s.currency,
      status: 'pending', expiresAt: new Date(Date.now() + days * 86_400_000), note: String(dto.note || '').trim().slice(0, 200) || null, origin, createdBy: actor,
    }));
    // ссылка нужна в любом случае: не ушло письмо (нет почты отеля) — отдаём ссылку и причину
    let sendError: { code: string; message: string } | null = null;
    if (dto.sendEmail) {
      try {
        await this.send(tenantId, row.id);
      } catch (e) {
        const body = (e as any)?.getResponse?.() || {};
        sendError = { code: String(body.code || 'SEND_FAILED'), message: String(body.message || (e as Error).message) };
      }
    }
    return { ...(await this.view(await this.reqs.findOneOrFail({ where: { id: row.id } }))), sendError };
  }

  private async view(q: HotelPaymentRequest) {
    return { ...q, amount: num(q.amount), url: await this.url(q.tenantId, q.token) };
  }

  async list(tenantId: string, query: { reservationId?: string; hotelId?: string; status?: string }) {
    const where: any = { tenantId };
    if (query.reservationId) where.reservationId = query.reservationId;
    if (query.hotelId) where.hotelId = query.hotelId;
    if (query.status) where.status = query.status;
    const rows = await this.reqs.find({ where, order: { createdAt: 'DESC' }, take: 200 });
    if (!rows.length) return [];
    const base = await tenantFrontend((sql, params) => this.reqs.manager.query(sql, params), tenantId);
    return rows.map((q) => ({ ...q, amount: num(q.amount), url: `${base}/hp/${q.token}` }));
  }

  async cancel(tenantId: string, id: string) {
    const q = await this.reqs.findOne({ where: { id, tenantId } });
    if (!q) throw new NotFoundException('Запрос оплаты не найден');
    if (q.status !== 'pending') throw bad('HOTEL_PAY_NOT_PENDING', 'Запрос уже оплачен или закрыт');
    q.status = 'cancelled';
    await this.reqs.save(q);
    await this.payments.update({ hotelPaymentRequestId: q.id, status: 'pending' } as any, { status: 'cancelled' });
    return this.view(q);
  }

  /** Письмо гостю со ссылкой — с почты отеля (TenantMailService), на языке гостя */
  async send(tenantId: string, id: string) {
    const q = await this.reqs.findOne({ where: { id, tenantId } });
    if (!q) throw new NotFoundException('Запрос оплаты не найден');
    if (q.status !== 'pending') throw bad('HOTEL_PAY_NOT_PENDING', 'Запрос уже оплачен или закрыт');
    const r = await this.reservation(tenantId, q.reservationId);
    if (!r.guestEmail) throw bad('HOTEL_PAY_NO_EMAIL', 'У брони нет email гостя');
    const hotel = await this.hotels.findOne({ where: { id: r.hotelId, tenantId } });
    const url = await this.url(tenantId, q.token);
    const lang = HotelReservationsService.guestLang(r.guestCountry);
    const loc = lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-GB' : 'ru-RU';
    const amount = new Intl.NumberFormat(loc, { style: 'currency', currency: q.currency }).format(num(q.amount));
    const name = hotel?.name || '';
    const due = q.expiresAt ? q.expiresAt.toISOString().slice(0, 10) : '';
    const T = {
      ru: { s: `Оплата брони ${r.bookingCode || ''} — ${name}`, h: `Здравствуйте, ${esc(r.guestName)}!`, b: `Для подтверждения брони с ${r.checkIn} по ${r.checkOut} оплатите, пожалуйста, ${amount}. Оплата картой на защищённой странице платёжной системы.`, d: `Ссылка действует до ${due}.`, c: 'Оплатить' },
      en: { s: `Booking payment ${r.bookingCode || ''} — ${name}`, h: `Dear ${esc(r.guestName)},`, b: `To confirm your stay from ${r.checkIn} to ${r.checkOut}, please pay ${amount}. Card payment on the payment provider's secure page.`, d: `The link is valid until ${due}.`, c: 'Pay now' },
      tr: { s: `Rezervasyon ödemesi ${r.bookingCode || ''} — ${name}`, h: `Sayın ${esc(r.guestName)},`, b: `${r.checkIn} – ${r.checkOut} konaklamanızı onaylamak için lütfen ${amount} ödeyin. Ödeme, ödeme kuruluşunun güvenli sayfasında kartla yapılır.`, d: `Bağlantı ${due} tarihine kadar geçerlidir.`, c: 'Öde' },
    }[lang];
    await this.tenantMail.sendOrThrow(tenantId, {
      to: r.guestEmail,
      subject: T.s,
      html: `<p>${T.h}</p><p>${T.b}</p><p><a href="${url}" style="display:inline-block;padding:10px 18px;background:#222;color:#fff;border-radius:8px;text-decoration:none">${T.c}</a></p><p style="color:#888;font-size:12px">${T.d}<br/>${url}</p>`,
    });
    q.sentAt = new Date();
    q.sentTo = r.guestEmail;
    await this.reqs.save(q);
    return { ok: true, sentTo: r.guestEmail };
  }

  // ─── публичная страница /hp/:token ───

  private async byToken(token: string) {
    const q = /^[a-f0-9]{48}$/.test(String(token || '')) ? await this.reqs.findOne({ where: { token } }) : null;
    if (!q) throw new NotFoundException('Ссылка на оплату не найдена');
    if (q.status === 'pending' && q.expiresAt && q.expiresAt.getTime() < Date.now()) {
      q.status = 'expired';
      await this.reqs.save(q);
    }
    return q;
  }

  async publicGet(token: string) {
    const q = await this.byToken(token);
    const [r, hotel] = await Promise.all([this.reservations.findOne({ where: { id: q.reservationId, tenantId: q.tenantId } }), this.hotels.findOne({ where: { id: q.hotelId, tenantId: q.tenantId } })]);
    if (!r || !hotel) throw new NotFoundException('Ссылка на оплату не найдена');
    // покупатель вернулся со страницы оплаты раньше вебхука — сверяем сами
    if (q.status === 'pending') await this.reconcileOne(q);
    if (!q.openedAt) await this.reqs.update({ id: q.id }, { openedAt: new Date() });
    const rt = await this.roomTypes.findOne({ where: { id: r.roomTypeId } });
    const last = await this.payments.findOne({ where: { hotelPaymentRequestId: q.id } as any, order: { createdAt: 'DESC' } });
    const provider = await this.paymentsService.enabledProviderInfo(q.tenantId);
    return {
      status: q.status, amount: num(q.amount), currency: q.currency, expiresAt: q.expiresAt, paidAt: q.paidAt, kind: q.kind,
      hotel: { name: hotel.name, city: hotel.city, country: hotel.country }, guestName: r.guestName, bookingCode: r.bookingCode,
      checkIn: r.checkIn, checkOut: r.checkOut, roomType: rt?.name ?? null, pax: r.pax, children: r.children,
      lang: HotelReservationsService.guestLang(r.guestCountry), provider: provider?.provider ?? null,
      lastAttempt: last ? { status: last.status, failReason: last.failReason } : null,
      buyer: { name: r.guestName, email: r.guestEmail, phone: r.guestPhone, city: hotel.city },
    };
  }

  async publicCheckout(token: string, dto: { name?: string; email?: string; phone?: string; city?: string; address?: string; lang?: string }, ip: string) {
    const q = await this.byToken(token);
    if (q.status !== 'pending') throw bad('HOTEL_PAY_NOT_PENDING', q.status === 'paid' ? 'Уже оплачено' : 'Ссылка на оплату больше не действует');
    const r = await this.reservation(q.tenantId, q.reservationId);
    if (!OPEN.includes(r.status)) throw bad('HOTEL_PAY_CLOSED', 'Бронь отменена — оплата не нужна');
    const hotel = await this.hotels.findOne({ where: { id: q.hotelId, tenantId: q.tenantId } });
    const s = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
    const name = s(dto.name, 120) || r.guestName;
    const email = s(dto.email, 190) || r.guestEmail || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('HOTEL_PAY_EMAIL', 'Укажите email — на него придёт чек платёжной системы');
    const pay = await this.paymentsService.createHotelCheckout({
      tenantId: q.tenantId, hotelPaymentRequestId: q.id, amount: num(q.amount), currency: q.currency,
      description: [hotel?.name, r.bookingCode, `${r.checkIn}–${r.checkOut}`].filter(Boolean).join(' · '),
      buyer: { name, email, phone: s(dto.phone, 32) || r.guestPhone || undefined, city: s(dto.city, 80) || hotel?.city || 'Antalya', address: s(dto.address, 300) || hotel?.address || hotel?.city || 'Hotel', ip: ip || '127.0.0.1' },
      returnUrl: await this.url(q.tenantId, q.token),
      locale: dto.lang === 'tr' ? 'tr' : 'en',
    });
    if (!pay.paymentPageUrl) throw bad('HOTEL_PAY_PROVIDER', 'Платёжная система не вернула страницу оплаты');
    return { url: pay.paymentPageUrl };
  }

  // ─── зачисление ───

  /** Оплачено: один раз (условный UPDATE) — платёж в фолио брони способом «онлайн», мимо кассовой смены */
  async applyPaid(requestId: string, p: Payment) {
    // TypeORM на UPDATE … RETURNING отдаёт [строки, число изменённых] — смотрим на число, не на длину ответа
    const res: unknown = await this.reqs.manager.query(
      `UPDATE hotel_payment_requests SET status = 'paid', "paymentId" = $2, "paidAt" = now(), "updatedAt" = now() WHERE id = $1 AND status IN ('pending', 'expired', 'cancelled') AND "paymentId" IS DISTINCT FROM $2 RETURNING id`,
      [requestId, p.id],
    );
    const rows = Array.isArray(res) && Array.isArray(res[0]) ? (res[0] as unknown[]) : (res as unknown[]);
    const won = Array.isArray(rows) && rows.length > 0;
    const q = await this.reqs.findOne({ where: { id: requestId } });
    if (!won || !q) return false;
    try {
      const saved = await this.reservationsService.addPayment(
        q.tenantId, q.reservationId,
        { amount: String(num(p.amount)), method: 'online', folio: q.folio, note: `Онлайн · ${p.provider} · ${p.id.slice(0, 8)}` },
        null, true,
      );
      const entry = [...(saved.payments || [])].reverse().find((x) => x.method === 'online');
      if (entry) await this.reqs.update({ id: q.id }, { reservationPaymentId: entry.id });
      return true;
    } catch (e) {
      // деньги списаны, а в бронь не записали — откатываем статус, чтобы сверка повторила
      await this.reqs.update({ id: q.id }, { status: 'pending', paymentId: null, paidAt: null });
      this.log.error(`hotel payment ${q.id}: не записан в бронь: ${(e as Error).message}`);
      throw e;
    }
  }

  private async reconcileOne(q: HotelPaymentRequest) {
    const paid = await this.payments.findOne({ where: { hotelPaymentRequestId: q.id, status: 'paid' } as any, order: { paidAt: 'ASC' } });
    if (paid) {
      await this.applyPaid(q.id, paid).catch(() => undefined);
      const fresh = await this.reqs.findOne({ where: { id: q.id } });
      if (fresh) Object.assign(q, fresh);
    }
  }

  /** Крон: оплаченные платежи, чей хук не дошёл; просроченные ссылки */
  async reconcile() {
    const rows: Array<{ id: string }> = await this.reqs.manager.query(
      `SELECT DISTINCT r.id FROM hotel_payment_requests r JOIN payments p ON p."hotelPaymentRequestId" = r.id AND p.status = 'paid'
        WHERE r.status <> 'paid' LIMIT 50`,
    );
    for (const { id } of rows) {
      const q = await this.reqs.findOne({ where: { id } });
      if (q) await this.reconcileOne(q).catch((e) => this.log.warn(`reconcile ${id}: ${(e as Error).message}`));
    }
    await this.reqs.update({ status: 'pending', expiresAt: LessThan(new Date()) }, { status: 'expired' });
    return rows.length;
  }

  /** Для витрины: запрос оплаты брони с сайта (предоплата по тарифу или вся сумма) — повторно не плодим */
  async forWebsite(tenantId: string, reservationId: string) {
    const existing = await this.reqs.findOne({ where: { tenantId, reservationId, status: In(['pending']), origin: 'website' }, order: { createdAt: 'DESC' } });
    if (existing) return this.view(existing);
    const s = await this.suggest(tenantId, reservationId);
    return this.create(tenantId, { reservationId, kind: s.depositLeft > 0 ? 'deposit' : 'balance', amount: s.depositLeft > 0 ? s.depositLeft : s.balance.guest, expiresInDays: 2 }, null, 'website');
  }
}
