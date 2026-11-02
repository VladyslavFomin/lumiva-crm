import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelAgency } from './hotel-agency.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelExtraService, HotelFolioKind, HotelFolioLine } from './hotel-folio.entities';
import {
  HOTEL_EINVOICE_PROVIDERS,
  HotelEInvoice,
  HotelEInvoiceConnection,
  HotelEInvoiceLine,
  HotelEInvoiceProvider,
  HotelEInvoiceRecipient,
  HotelEInvoiceSettings,
  HotelEInvoiceTotals,
} from './hotel-einvoice.entities';
import { EInvoiceCredentials, EInvoiceProviderAdapter, EInvoiceProviderError, EInvoiceTokenUpdate } from './hotel-einvoice-provider';
import { ParasutEInvoiceAdapter } from './hotel-einvoice-parasut';
import { tcmbForexBuying } from './hotel-tcmb-rate.util';
import { hotelTaxes } from './hotel-tax.util';
import { folioSummary, businessDateOf } from './hotel-folio.service';
import { decryptSecret, encryptSecret, maskSecret } from '../hotel-reputation/reputation-crypto.util';
import { normalizeNumericInput } from './hotel-number.util';

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const bad = (code: string, message: string) => new BadRequestException({ code, message });
/** e-Arşiv частному лицу без турецкого номера (иностранный гость) — условный TCKN, как принято в GİB */
const NO_TCKN = '11111111111';
const DEFAULT_EXTRAS_VAT = 20;
/** e-Arşiv можно отменить 7 дней после выставления (правило GİB) */
const CANCEL_DAYS = 7;

const nightsOf = (a: string, b: string) => Math.max(1, Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000));
const trDate = (iso: string) => iso.split('-').reverse().join('.');

/** Итоги строки так же, как их посчитает интегратор: база − скидка → налог на проживание → KDV на (база + налог) */
export function einvoiceLineTotals(l: Pick<HotelEInvoiceLine, 'quantity' | 'unitPrice' | 'discount' | 'vatPct' | 'accTaxPct'>) {
  const net = r2(l.quantity * l.unitPrice - (l.discount || 0));
  const acc = r2(net * (l.accTaxPct || 0) / 100);
  const vat = r2((net + acc) * (l.vatPct || 0) / 100);
  return { net, acc, vat, gross: r2(net + acc + vat) };
}

export function einvoiceTotals(lines: HotelEInvoiceLine[]): HotelEInvoiceTotals {
  const t = { net: 0, accTax: 0, vat: 0, gross: 0 };
  for (const l of lines) {
    const x = einvoiceLineTotals(l);
    t.net += x.net; t.accTax += x.acc; t.vat += x.vat; t.gross += x.gross;
  }
  return { net: r2(t.net), accTax: r2(t.accTax), vat: r2(t.vat), gross: r2(t.gross) };
}

/**
 * e-Fatura / e-Arşiv по фолио брони. Общий слой: черновик из фолио (проживание с налогом на проживание и KDV,
 * услуги со своей ставкой KDV, скидки), получатель, курс TCMB, хранение документа и статуса; адаптер интегратора
 * (сейчас Paraşüt) — только перевод в его API. Формирование у интегратора асинхронное — опрос раз в минуту.
 */
@Injectable()
export class HotelEInvoiceService {
  private readonly log = new Logger(HotelEInvoiceService.name);
  private readonly adapters: Record<HotelEInvoiceProvider, EInvoiceProviderAdapter> = { parasut: new ParasutEInvoiceAdapter() };

  constructor(
    @InjectRepository(HotelEInvoiceConnection) private readonly conns: Repository<HotelEInvoiceConnection>,
    @InjectRepository(HotelEInvoice) private readonly docs: Repository<HotelEInvoice>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelReservation) private readonly reservations: Repository<HotelReservation>,
    @InjectRepository(HotelFolioLine) private readonly lines: Repository<HotelFolioLine>,
    @InjectRepository(HotelExtraService) private readonly extras: Repository<HotelExtraService>,
    @InjectRepository(HotelAgency) private readonly agencies: Repository<HotelAgency>,
    @InjectRepository(HotelRoomType) private readonly roomTypes: Repository<HotelRoomType>,
  ) {}

  private async hotel(tenantId: string, hotelId: string) {
    const h = await this.hotels.findOne({ where: { id: hotelId, tenantId } });
    if (!h) throw new NotFoundException('Отель не найден');
    return h;
  }

  // ─── подключение ───

  private view(c: HotelEInvoiceConnection | null, hotelId: string) {
    if (!c) return { hotelId, connected: false, provider: null, active: false, settings: { extrasVatPct: DEFAULT_EXTRAS_VAT, accTaxMode: 'line_tax' } };
    return {
      hotelId, connected: true, id: c.id, provider: c.provider, active: c.active, clientId: c.clientId, username: c.username, externalCompanyId: c.externalCompanyId,
      clientSecretMasked: maskSecret(c.clientSecretEnc), passwordSet: !!c.passwordEnc,
      settings: { extrasVatPct: DEFAULT_EXTRAS_VAT, accTaxMode: 'line_tax', ...c.settings }, lastCheckedAt: c.lastCheckedAt, lastError: c.lastError,
    };
  }

  async getConnection(tenantId: string, hotelId: string) {
    await this.hotel(tenantId, hotelId);
    return this.view(await this.conns.findOne({ where: { tenantId, hotelId } }), hotelId);
  }

  async saveConnection(
    tenantId: string,
    dto: { hotelId: string; provider?: string; active?: boolean; clientId?: string; clientSecret?: string; username?: string; password?: string; externalCompanyId?: string; settings?: Partial<HotelEInvoiceSettings> },
  ) {
    await this.hotel(tenantId, dto?.hotelId);
    let c = await this.conns.findOne({ where: { tenantId, hotelId: dto.hotelId } });
    const provider = (dto.provider || c?.provider || 'parasut') as HotelEInvoiceProvider;
    if (!HOTEL_EINVOICE_PROVIDERS.includes(provider)) throw bad('HOTEL_EINVOICE_PROVIDER_UNKNOWN', 'Интегратор не поддерживается');
    if (!c) c = this.conns.create({ tenantId, hotelId: dto.hotelId, provider, settings: {} });
    let credsChanged = c.provider !== provider;
    c.provider = provider;
    const str = (v: unknown) => String(v ?? '').trim();
    if (dto.clientId !== undefined && str(dto.clientId) !== (c.clientId || '')) { c.clientId = str(dto.clientId) || null; credsChanged = true; }
    if (dto.username !== undefined && str(dto.username) !== (c.username || '')) { c.username = str(dto.username) || null; credsChanged = true; }
    if (dto.externalCompanyId !== undefined && str(dto.externalCompanyId) !== (c.externalCompanyId || '')) {
      if (str(dto.externalCompanyId) && !/^\d{1,12}$/.test(str(dto.externalCompanyId))) throw bad('HOTEL_EINVOICE_COMPANY_ID', 'Номер фирмы — только цифры (из адреса кабинета Paraşüt)');
      c.externalCompanyId = str(dto.externalCompanyId) || null;
      credsChanged = true;
    }
    // секреты приходят только при смене: пустое значение = «не менять»
    if (str(dto.clientSecret)) { c.clientSecretEnc = encryptSecret(str(dto.clientSecret)); credsChanged = true; }
    if (str(dto.password)) { c.passwordEnc = encryptSecret(str(dto.password)); credsChanged = true; }
    if (dto.active !== undefined) c.active = !!dto.active;
    if (dto.settings) {
      const s = { ...c.settings };
      if (dto.settings.invoiceSeries !== undefined) s.invoiceSeries = str(dto.settings.invoiceSeries).toUpperCase().slice(0, 3) || null;
      if (dto.settings.extrasVatPct !== undefined) {
        const v = Number(normalizeNumericInput(dto.settings.extrasVatPct as any));
        if (!(v >= 0 && v <= 100)) throw bad('HOTEL_EINVOICE_VAT', 'Ставка KDV — от 0 до 100 %');
        s.extrasVatPct = v;
      }
      if (dto.settings.accTaxMode !== undefined) s.accTaxMode = dto.settings.accTaxMode === 'separate_line' ? 'separate_line' : 'line_tax';
      c.settings = s;
    }
    if (credsChanged) {
      // другие доступы — другой кабинет: токены и привязки к его справочникам сбрасываем
      c.accessTokenEnc = null; c.refreshTokenEnc = null; c.tokenExpiresAt = null; c.lastCheckedAt = null; c.lastError = null;
      c.settings = { ...c.settings, parasutAccProductId: null };
    }
    return this.view(await this.conns.save(c), dto.hotelId);
  }

  private creds(c: HotelEInvoiceConnection): EInvoiceCredentials {
    const clientSecret = decryptSecret(c.clientSecretEnc);
    const password = decryptSecret(c.passwordEnc);
    if (!c.clientId || !clientSecret || !c.username || !password || !c.externalCompanyId) {
      throw bad('HOTEL_EINVOICE_NOT_CONFIGURED', 'Заполните доступы интегратора: client id и secret, логин, пароль и номер фирмы');
    }
    return {
      clientId: c.clientId, clientSecret, username: c.username, password, companyId: c.externalCompanyId,
      accessToken: decryptSecret(c.accessTokenEnc), refreshToken: decryptSecret(c.refreshTokenEnc), tokenExpiresAt: c.tokenExpiresAt,
    };
  }

  private onToken(c: HotelEInvoiceConnection) {
    return async (t: EInvoiceTokenUpdate) => {
      c.accessTokenEnc = encryptSecret(t.accessToken);
      c.refreshTokenEnc = t.refreshToken ? encryptSecret(t.refreshToken) : null;
      c.tokenExpiresAt = t.tokenExpiresAt;
      await this.conns.update({ id: c.id }, { accessTokenEnc: c.accessTokenEnc, refreshTokenEnc: c.refreshTokenEnc, tokenExpiresAt: c.tokenExpiresAt });
    };
  }

  private providerError(e: unknown): never {
    if (e instanceof EInvoiceProviderError) throw bad(e.code, e.message);
    throw e;
  }

  async testConnection(tenantId: string, hotelId: string) {
    const c = await this.conns.findOne({ where: { tenantId, hotelId } });
    if (!c) throw bad('HOTEL_EINVOICE_NOT_CONFIGURED', 'Сначала сохраните доступы интегратора');
    try {
      await this.adapters[c.provider].testConnection(this.creds(c), this.onToken(c));
      await this.conns.update({ id: c.id }, { lastCheckedAt: new Date(), lastError: null });
      return { ok: true };
    } catch (e) {
      await this.conns.update({ id: c.id }, { lastCheckedAt: new Date(), lastError: (e as Error).message.slice(0, 1000) });
      this.providerError(e);
    }
  }

  // ─── черновик из фолио ───

  private async recipientOf(r: HotelReservation, folio: HotelFolioKind): Promise<HotelEInvoiceRecipient> {
    if (folio === 'partner' && r.agencyId) {
      const a = await this.agencies.findOne({ where: { id: r.agencyId, tenantId: r.tenantId } });
      if (a) {
        const country = (a.countryCode || '').toUpperCase() || null;
        return {
          kind: 'company', name: a.legalName || a.name, taxNumber: String(a.taxId || '').replace(/\s/g, ''), taxOffice: null, address: a.address, city: a.city,
          district: null, country, email: a.email, phone: a.phone, abroad: !!country && country !== 'TR',
        };
      }
    }
    const lead = (r.guests || []).find((g) => /^\d{11}$/.test(String(g.tcKimlikNo || '').trim()));
    const nat = String((r.guests || [])[0]?.nationalityCode || r.guestCountry || '').toUpperCase().slice(0, 2) || null;
    return {
      kind: 'person', name: r.guestName, taxNumber: lead ? String(lead.tcKimlikNo).trim() : NO_TCKN, taxOffice: null, address: null, city: null, district: null,
      country: nat, email: r.guestEmail, phone: r.guestPhone, abroad: !lead && !!nat && nat !== 'TR',
    };
  }

  /** Строки счёта из фолио: проживание (или штраф отмены) — в своём фолио, услуги — по своей ставке KDV, скидки — на самую крупную строку */
  private async linesOf(r: HotelReservation, h: Hotel, folio: HotelFolioKind, settings: HotelEInvoiceSettings) {
    const warnings: string[] = [];
    const all = await this.lines.find({ where: { tenantId: r.tenantId, reservationId: r.id } });
    const summary = folioSummary(r, all, h);
    const out: HotelEInvoiceLine[] = [];
    const vatPct = num(h.vatPct);
    const accPct = num(h.accommodationTaxPct);
    const separate = settings.accTaxMode === 'separate_line';
    if (summary.accommodationFolio === folio) {
      if (r.status === 'cancelled' || r.status === 'no_show') {
        const fee = num(r.cancellationFee);
        if (fee > 0) {
          out.push({ kind: 'cancel_fee', description: `${r.status === 'no_show' ? 'No-show bedeli' : 'İptal bedeli'} · ${r.bookingCode || ''}`.trim(), quantity: 1, unitPrice: r2(fee / (1 + vatPct / 100)), vatPct, accTaxPct: 0, discount: 0, gross: r2(fee) });
        }
      } else if (num(r.total) > 0) {
        const t = hotelTaxes(num(r.total), h);
        const rt = r.roomTypeId ? await this.roomTypes.findOne({ where: { id: r.roomTypeId } }) : null;
        const n = nightsOf(r.checkIn, r.checkOut);
        const desc = ['Konaklama', rt?.name, `${trDate(r.checkIn)}–${trDate(r.checkOut)}`, `${n} gece`, r.bookingCode].filter(Boolean).join(' · ');
        if (separate && accPct > 0) {
          out.push({ kind: 'accommodation', description: desc, quantity: 1, unitPrice: t.base, vatPct, accTaxPct: 0, discount: 0, gross: r2(t.base * (1 + vatPct / 100)) });
          out.push({ kind: 'acc_tax', description: `Konaklama vergisi %${accPct}`, quantity: 1, unitPrice: t.accommodationTax, vatPct, accTaxPct: 0, discount: 0, gross: r2(t.accommodationTax * (1 + vatPct / 100)) });
        } else {
          out.push({ kind: 'accommodation', description: desc, quantity: 1, unitPrice: t.base, vatPct, accTaxPct: accPct, discount: 0, gross: t.total });
        }
      }
    }
    const mine = all.filter((l) => (l.folio === 'partner' ? 'partner' : 'guest') === folio && !l.voided && !l.voidOfId);
    const ids = [...new Set(mine.map((l) => l.extraServiceId).filter(Boolean))] as string[];
    const cat = ids.length ? await this.extras.find({ where: { tenantId: r.tenantId, id: In(ids) } }) : [];
    let negative = 0;
    for (const l of mine) {
      const amount = num(l.amount);
      if (amount < 0) { negative += -amount; continue; }
      if (!(amount > 0)) continue;
      const ex = cat.find((x) => x.id === l.extraServiceId);
      const v = ex?.vatPct !== null && ex?.vatPct !== undefined ? num(ex.vatPct) : num(settings.extrasVatPct ?? DEFAULT_EXTRAS_VAT);
      const qty = num(l.quantity) > 0 ? num(l.quantity) : 1;
      out.push({ kind: 'extra', description: l.description, quantity: qty, unitPrice: Math.round((amount / (1 + v / 100) / qty) * 1e4) / 1e4, vatPct: v, accTaxPct: 0, discount: 0, gross: r2(amount) });
    }
    if (negative > 0) {
      const target = [...out].sort((a, b) => b.gross - a.gross)[0];
      if (!target || target.gross < negative) warnings.push('discount_exceeds');
      else {
        const factor = (1 + target.accTaxPct / 100) * (1 + target.vatPct / 100);
        target.discount = r2(negative / factor);
        target.gross = r2(target.gross - negative);
      }
    }
    // гостевой счёт без брони-суммы и без услуг — выставлять нечего
    if (!out.length) warnings.push('empty');
    const totals = einvoiceTotals(out);
    const charges = summary.folios[folio].charges;
    if (out.length && Math.abs(totals.gross - charges) > 0.05) warnings.push('total_mismatch');
    return { lines: out, totals, folioCharges: charges, warnings };
  }

  private async reservation(tenantId: string, id: string) {
    const r = await this.reservations.findOne({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Бронь не найдена');
    return r;
  }

  async draft(tenantId: string, reservationId: string, folioIn: string) {
    const r = await this.reservation(tenantId, reservationId);
    const h = await this.hotel(tenantId, r.hotelId);
    const folio: HotelFolioKind = folioIn === 'partner' ? 'partner' : 'guest';
    const c = await this.conns.findOne({ where: { tenantId, hotelId: h.id } });
    const settings: HotelEInvoiceSettings = { extrasVatPct: DEFAULT_EXTRAS_VAT, accTaxMode: 'line_tax', ...(c?.settings || {}) };
    const built = await this.linesOf(r, h, folio, settings);
    const currency = (h.currency || 'TRY').toUpperCase();
    const fx = currency === 'TRY' ? null : await tcmbForexBuying(currency);
    const existing = await this.docs.find({ where: { tenantId, reservationId, folio, status: In(['sending', 'issued']) }, order: { createdAt: 'DESC' } });
    return {
      reservationId, folio, connected: !!c?.active, provider: c?.provider ?? null, issueDate: businessDateOf(h), currency,
      exchangeRate: fx?.rate ?? null, exchangeRateDate: fx?.date ?? null, recipient: await this.recipientOf(r, folio), ...built,
      existing: existing.map((d) => ({ id: d.id, status: d.status, invoiceNo: d.invoiceNo, gross: d.totals.gross, createdAt: d.createdAt })),
    };
  }

  // ─── выставление ───

  private cleanRecipient(p: Partial<HotelEInvoiceRecipient> | undefined): HotelEInvoiceRecipient {
    const s = (v: unknown, n = 255) => String(v ?? '').trim().slice(0, n) || null;
    const kind = p?.kind === 'company' ? 'company' : 'person';
    const taxNumber = String(p?.taxNumber ?? '').replace(/\D/g, '');
    const name = s(p?.name, 255);
    if (!name) throw bad('HOTEL_EINVOICE_RECIPIENT_NAME', 'Укажите получателя счёта');
    // зарубежной компании без турецкого VKN — условный 2222222222 (только если номер не указан)
    if (kind === 'company' && !/^\d{10}$/.test(taxNumber) && !(p?.abroad && !taxNumber)) throw bad('HOTEL_EINVOICE_VKN', 'У компании — налоговый номер VKN из 10 цифр (у зарубежной без VKN оставьте пустым)');
    if (kind === 'person' && !/^\d{11}$/.test(taxNumber)) throw bad('HOTEL_EINVOICE_TCKN', 'У частного лица — TCKN из 11 цифр (иностранцу без номера — 11111111111)');
    return {
      kind, name, taxNumber: taxNumber || (kind === 'company' ? '2222222222' : NO_TCKN), taxOffice: s(p?.taxOffice, 120), address: s(p?.address, 500), city: s(p?.city, 120),
      district: s(p?.district, 120), country: s(p?.country, 2)?.toUpperCase() ?? null, email: s(p?.email, 190), phone: s(p?.phone, 64), abroad: !!p?.abroad,
    };
  }

  private cleanLines(lines: Partial<HotelEInvoiceLine>[] | undefined): HotelEInvoiceLine[] {
    const kinds = ['accommodation', 'cancel_fee', 'extra', 'acc_tax'];
    const out = (Array.isArray(lines) ? lines : []).slice(0, 200).map((l) => {
      const q = num(l.quantity), u = num(l.unitPrice), v = num(l.vatPct), a = num(l.accTaxPct), d = num(l.discount);
      const description = String(l.description ?? '').trim().slice(0, 255);
      if (!description) throw bad('HOTEL_EINVOICE_LINE', 'У каждой строки — описание');
      if (!(q > 0) || !(u >= 0) || !(v >= 0 && v <= 100) || !(a >= 0 && a <= 100) || !(d >= 0) || d > q * u + 0.001) throw bad('HOTEL_EINVOICE_LINE', `Строка «${description}»: проверьте количество, цену, ставки и скидку`);
      const line: HotelEInvoiceLine = { kind: (kinds.includes(String(l.kind)) ? l.kind : 'extra') as HotelEInvoiceLine['kind'], description, quantity: q, unitPrice: u, vatPct: v, accTaxPct: l.kind === 'accommodation' ? a : 0, discount: r2(d), gross: 0 };
      line.gross = einvoiceLineTotals(line).gross;
      return line;
    });
    if (!out.length) throw bad('HOTEL_EINVOICE_EMPTY', 'В счёте нет строк');
    return out;
  }

  async issue(
    tenantId: string,
    reservationId: string,
    dto: { folio?: string; recipient?: Partial<HotelEInvoiceRecipient>; lines?: Partial<HotelEInvoiceLine>[]; exchangeRate?: number | string | null; note?: string; allowAnother?: boolean },
    actor: string | null,
  ) {
    const r = await this.reservation(tenantId, reservationId);
    const h = await this.hotel(tenantId, r.hotelId);
    const c = await this.conns.findOne({ where: { tenantId, hotelId: h.id } });
    if (!c || !c.active) throw bad('HOTEL_EINVOICE_NOT_CONNECTED', 'e-Fatura не подключена для этого отеля');
    const creds = this.creds(c);
    const folio: HotelFolioKind = dto?.folio === 'partner' ? 'partner' : 'guest';
    // второй действующий счёт по тому же фолио — только осознанно (доначисления после первого счёта)
    const dup = await this.docs.findOne({ where: { tenantId, reservationId, folio, status: In(['sending', 'issued']) } });
    if (dup && !dto.allowAnother) throw bad('HOTEL_EINVOICE_EXISTS', `По этому счёту уже выставлен документ${dup.invoiceNo ? ` ${dup.invoiceNo}` : ''}`);
    const recipient = this.cleanRecipient(dto.recipient);
    const lines = this.cleanLines(dto.lines);
    const currency = (h.currency || 'TRY').toUpperCase();
    let rate: number | null = null;
    if (currency !== 'TRY') {
      rate = dto.exchangeRate !== undefined && dto.exchangeRate !== null && String(dto.exchangeRate) !== '' ? num(normalizeNumericInput(dto.exchangeRate as any)) : (await tcmbForexBuying(currency))?.rate ?? null;
      if (!(rate && rate > 0)) throw bad('HOTEL_EINVOICE_RATE', `Нужен курс ${currency}/TRY — ЦБ Турции не ответил, укажите курс вручную`);
    }
    const doc = await this.docs.save(this.docs.create({
      tenantId, hotelId: h.id, reservationId, folio, provider: c.provider, status: 'sending', issueDate: businessDateOf(h), currency, exchangeRate: rate === null ? null : String(rate),
      recipient, lines, totals: einvoiceTotals(lines), note: String(dto.note || '').trim().slice(0, 500) || null, createdBy: actor,
    }));
    try {
      const res = await this.adapters[c.provider].issue(creds, this.onToken(c), {
        issueDate: doc.issueDate, currency, exchangeRate: rate, recipient, lines, note: doc.note,
        description: [h.name, r.bookingCode, r.guestName].filter(Boolean).join(' · ').slice(0, 255), settings: { extrasVatPct: DEFAULT_EXTRAS_VAT, accTaxMode: 'line_tax', ...c.settings },
      });
      if (res.settings) await this.conns.update({ id: c.id }, { settings: { ...c.settings, ...res.settings } });
      Object.assign(doc, { externalInvoiceId: res.externalInvoiceId, externalJobId: res.jobId, docType: res.docType });
      await this.docs.save(doc);
    } catch (e) {
      doc.status = 'error';
      doc.error = (e as Error).message.slice(0, 2000);
      await this.docs.save(doc);
      this.providerError(e);
    }
    await this.pollOne(doc).catch(() => undefined);
    return this.docs.findOneOrFail({ where: { id: doc.id } });
  }

  /** Опрос формирования документа у интегратора */
  private async pollOne(doc: HotelEInvoice) {
    if (doc.status !== 'sending' || !doc.externalInvoiceId) return doc;
    const c = await this.conns.findOne({ where: { tenantId: doc.tenantId, hotelId: doc.hotelId } });
    if (!c) return doc;
    doc.pollCount += 1;
    try {
      const st = await this.adapters[doc.provider].poll(this.creds(c), this.onToken(c), doc.externalInvoiceId, doc.externalJobId);
      if (st.state === 'done') Object.assign(doc, { status: 'issued', externalDocId: st.docId, invoiceNo: st.invoiceNo, issuedAt: new Date(), error: null });
      else if (st.state === 'error') Object.assign(doc, { status: 'error', error: st.error.slice(0, 2000) });
      else if (doc.pollCount >= 120) Object.assign(doc, { status: 'error', error: 'Интегратор не сформировал документ за 2 часа — проверьте счёт в его кабинете' });
    } catch (e) {
      this.log.warn(`einvoice poll ${doc.id}: ${(e as Error).message}`);
    }
    return this.docs.save(doc);
  }

  /** Крон: документы в формировании (раз в минуту, порциями) */
  async pollPending() {
    const rows = await this.docs.find({ where: { status: 'sending', pollCount: LessThan(120) }, order: { updatedAt: 'ASC' }, take: 20 });
    for (const d of rows) await this.pollOne(d);
    return rows.length;
  }

  async refresh(tenantId: string, id: string) {
    const d = await this.docs.findOne({ where: { id, tenantId } });
    if (!d) throw new NotFoundException('Документ не найден');
    return this.pollOne(d);
  }

  list(tenantId: string, q: { hotelId?: string; reservationId?: string; status?: string }) {
    const where: any = { tenantId };
    if (q.hotelId) where.hotelId = q.hotelId;
    if (q.reservationId) where.reservationId = q.reservationId;
    if (q.status && ['sending', 'issued', 'error', 'cancelled'].includes(q.status)) where.status = q.status;
    return this.docs.find({ where, order: { createdAt: 'DESC' }, take: 200 });
  }

  async pdf(tenantId: string, id: string) {
    const d = await this.docs.findOne({ where: { id, tenantId } });
    if (!d) throw new NotFoundException('Документ не найден');
    if (d.status !== 'issued' && d.status !== 'cancelled') throw bad('HOTEL_EINVOICE_NOT_READY', 'Документ ещё не сформирован');
    if (!d.externalDocId || !d.docType) throw bad('HOTEL_EINVOICE_NOT_READY', 'Документ ещё не сформирован');
    const c = await this.conns.findOne({ where: { tenantId, hotelId: d.hotelId } });
    if (!c) throw bad('HOTEL_EINVOICE_NOT_CONNECTED', 'e-Fatura не подключена для этого отеля');
    try {
      const url = await this.adapters[d.provider].pdfUrl(this.creds(c), this.onToken(c), d.docType, d.externalDocId);
      if (!url) throw bad('HOTEL_EINVOICE_PDF_PENDING', 'PDF у интегратора ещё готовится — попробуйте через минуту');
      return { url };
    } catch (e) {
      this.providerError(e);
    }
  }

  /** Отмена: только e-Arşiv и только 7 дней после выставления; e-Fatura отменяется возвратным счётом у интегратора */
  async cancel(tenantId: string, id: string) {
    const d = await this.docs.findOne({ where: { id, tenantId } });
    if (!d) throw new NotFoundException('Документ не найден');
    if (d.status === 'error') {
      // не сформированный документ просто убираем из действующих
      d.status = 'cancelled';
      d.cancelledAt = new Date();
      return this.docs.save(d);
    }
    if (d.status !== 'issued') throw bad('HOTEL_EINVOICE_NOT_READY', 'Документ ещё не сформирован');
    if (d.docType !== 'e_archive') throw bad('HOTEL_EINVOICE_CANCEL_EFATURA', 'e-Fatura не отменяется — оформите возвратный счёт (iade) в кабинете интегратора');
    if (d.issuedAt && Date.now() - d.issuedAt.getTime() > CANCEL_DAYS * 86_400_000) throw bad('HOTEL_EINVOICE_CANCEL_LATE', 'e-Arşiv можно отменить только 7 дней после выставления — дальше возвратный счёт');
    const c = await this.conns.findOne({ where: { tenantId, hotelId: d.hotelId } });
    if (!c) throw bad('HOTEL_EINVOICE_NOT_CONNECTED', 'e-Fatura не подключена для этого отеля');
    try {
      await this.adapters[d.provider].cancel(this.creds(c), this.onToken(c), d.externalInvoiceId!);
    } catch (e) {
      this.providerError(e);
    }
    d.status = 'cancelled';
    d.cancelledAt = new Date();
    return this.docs.save(d);
  }
}
