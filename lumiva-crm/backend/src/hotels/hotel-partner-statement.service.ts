import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { HotelReservation } from './hotel-reservation.entity';
import { HotelAgency } from './hotel-agency.entity';
import { Hotel } from './hotel.entity';
import { Tenant } from '../tenants/tenant.entity';
import { TenantMailService } from '../mail/tenant-mail.service';
import { resolveUnicodePdfFont } from '../common/pdf-font.util';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const toNum = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;
const nightsOf = (a: string, b: string) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000));

export type StatementBasis = 'checkout' | 'arrival';

export type PartnerStatement = {
  partner: { id: string; name: string; legalName: string | null; email: string | null; currency: string | null; paymentTerms: string; paymentDays: number };
  from: string;
  to: string;
  basis: StatementBasis;
  currency: string | null;
  rows: Array<{
    reservationId: string;
    bookingCode: string | null;
    hotel: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    status: string;
    gross: number;
    commissionPct: number;
    commission: number;
    net: number;
  }>;
  totals: { bookings: number; roomNights: number; gross: number; commission: number; net: number };
};

/**
 * Выписка партнёру за период: брони (без отменённых) по дате выезда — что реально прожито и подлежит расчёту —
 * или по дате заезда; брутто, комиссия, нетто. Модель цены «комиссия»: партнёр получает комиссию;
 * «нетто»: комиссия 0, партнёр платит отелю нетто. PDF/Excel, отправка — с почты отеля (TenantMailService).
 */
@Injectable()
export class HotelPartnerStatementService {
  constructor(
    @InjectRepository(HotelReservation) private readonly reservations: Repository<HotelReservation>,
    @InjectRepository(HotelAgency) private readonly partners: Repository<HotelAgency>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    private readonly tenantMail: TenantMailService,
  ) {}

  async build(tenantId: string, agencyId: string, q: { from?: string; to?: string; basis?: string }): Promise<PartnerStatement> {
    const partner = await this.partners.findOne({ where: { id: agencyId, tenantId } });
    if (!partner) throw new NotFoundException('Партнёр не найден');
    if (!q.from || !q.to || !DATE_RE.test(q.from) || !DATE_RE.test(q.to) || q.to < q.from) throw new BadRequestException('Укажите период выписки');
    const basis: StatementBasis = q.basis === 'arrival' ? 'arrival' : 'checkout';
    const col = basis === 'arrival' ? 'r.checkIn' : 'r.checkOut';
    const res = await this.reservations
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId AND r.agencyId = :agencyId', { tenantId, agencyId })
      .andWhere("r.status NOT IN ('cancelled','no_show')")
      .andWhere(`${col} BETWEEN :from AND :to`, { from: q.from, to: q.to })
      .orderBy(col, 'ASC')
      .getMany();
    const hotels = res.length ? await this.hotels.find({ where: { tenantId, id: In([...new Set(res.map((r) => r.hotelId))]) } }) : [];
    const hotelName = new Map(hotels.map((h) => [h.id, h.name]));
    const currencies = new Set(hotels.map((h) => (h.currency || '').toUpperCase()).filter(Boolean));
    const rows = res.map((r) => {
      const gross = toNum(r.total);
      const commission = toNum(r.commissionAmount);
      return {
        reservationId: r.id,
        bookingCode: r.bookingCode,
        hotel: hotelName.get(r.hotelId) || '—',
        guestName: r.guestName,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        nights: nightsOf(r.checkIn, r.checkOut),
        status: r.status,
        gross: round2(gross),
        commissionPct: toNum(r.commissionPct),
        commission: round2(commission),
        net: round2(toNum(r.netTotal) || gross - commission),
      };
    });
    return {
      partner: { id: partner.id, name: partner.name, legalName: partner.legalName, email: partner.email, currency: partner.currency, paymentTerms: partner.paymentTerms, paymentDays: partner.paymentDays },
      from: q.from,
      to: q.to,
      basis,
      // суммы хранятся в валюте отеля; разные валюты в одной выписке не складываем молча — валюта не указывается
      currency: currencies.size === 1 ? [...currencies][0] : null,
      rows,
      totals: {
        bookings: rows.length,
        roomNights: rows.reduce((s, r) => s + r.nights, 0),
        gross: round2(rows.reduce((s, r) => s + r.gross, 0)),
        commission: round2(rows.reduce((s, r) => s + r.commission, 0)),
        net: round2(rows.reduce((s, r) => s + r.net, 0)),
      },
    };
  }

  async xlsx(tenantId: string, agencyId: string, q: { from?: string; to?: string; basis?: string }) {
    const st = await this.build(tenantId, agencyId, q);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Statement');
    ws.addRow([`${st.partner.name} · ${st.from} — ${st.to}${st.currency ? ` · ${st.currency}` : ''}`]).font = { bold: true, size: 13 };
    ws.addRow([]);
    const head = ws.addRow(['Booking', 'Hotel', 'Guest', 'Check-in', 'Check-out', 'Nights', 'Gross', 'Commission %', 'Commission', 'Net']);
    head.font = { bold: true };
    for (const r of st.rows) ws.addRow([r.bookingCode || r.reservationId.slice(0, 8), r.hotel, r.guestName, r.checkIn, r.checkOut, r.nights, r.gross, r.commissionPct, r.commission, r.net]);
    const total = ws.addRow(['', '', 'Total', '', '', st.totals.roomNights, st.totals.gross, '', st.totals.commission, st.totals.net]);
    total.font = { bold: true };
    [12, 26, 24, 12, 12, 8, 12, 13, 12, 12].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), name: `statement-${st.partner.name.replace(/[^\p{L}\p{N}]+/gu, '-')}-${st.from}-${st.to}.xlsx` };
  }

  async pdf(tenantId: string, agencyId: string, q: { from?: string; to?: string; basis?: string }) {
    const st = await this.build(tenantId, agencyId, q);
    const tenant = await this.tenants.findOne({ where: { id: tenantId }, select: ['id', 'name'] });
    const money = (n: number) => `${n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${st.currency ? ` ${st.currency}` : ''}`;
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      const font = resolveUnicodePdfFont();
      if (font) doc.font(font);
      doc.fontSize(16).fillColor('#111').text(`Statement · ${st.partner.legalName || st.partner.name}`);
      doc.fontSize(9).fillColor('#666').text(`${tenant?.name || ''} · ${st.from} — ${st.to} · ${st.basis === 'arrival' ? 'by arrival date' : 'by departure date'}`);
      doc.moveDown(1);
      const cols = [
        { t: 'Booking', w: 70 }, { t: 'Hotel', w: 150 }, { t: 'Guest', w: 140 }, { t: 'Check-in', w: 62 }, { t: 'Check-out', w: 62 },
        { t: 'Nights', w: 38 }, { t: 'Gross', w: 78 }, { t: 'Comm. %', w: 44 }, { t: 'Commission', w: 78 }, { t: 'Net', w: 78 },
      ];
      const x0 = doc.page.margins.left;
      const row = (vals: string[], bold = false) => {
        if (doc.y > doc.page.height - 60) doc.addPage();
        const y = doc.y;
        let x = x0;
        doc.fontSize(8).fillColor(bold ? '#111' : '#333');
        vals.forEach((v, i) => {
          doc.text(v, x, y, { width: cols[i].w - 4, ellipsis: true, lineBreak: false, align: i >= 5 ? 'right' : 'left' });
          x += cols[i].w;
        });
        doc.y = y + 14;
        doc.moveTo(x0, doc.y - 3).lineTo(x0 + cols.reduce((s, c) => s + c.w, 0), doc.y - 3).strokeColor('#eee').lineWidth(0.5).stroke();
      };
      row(cols.map((c) => c.t), true);
      for (const r of st.rows) {
        row([r.bookingCode || r.reservationId.slice(0, 8), r.hotel, r.guestName, r.checkIn, r.checkOut, String(r.nights), money(r.gross), `${r.commissionPct}%`, money(r.commission), money(r.net)]);
      }
      row(['', '', `Total · ${st.totals.bookings}`, '', '', String(st.totals.roomNights), money(st.totals.gross), '', money(st.totals.commission), money(st.totals.net)], true);
      doc.moveDown(1);
      const terms = st.partner.paymentTerms === 'postpayment' ? `Payment terms: post-payment, ${st.partner.paymentDays} days` : st.partner.paymentTerms === 'on_arrival' ? 'Payment terms: on arrival' : 'Payment terms: prepayment';
      doc.fontSize(8).fillColor('#666').text(terms, x0);
      doc.end();
    });
    return { buffer, name: `statement-${st.partner.name.replace(/[^\p{L}\p{N}]+/gu, '-')}-${st.from}-${st.to}.pdf`, statement: st };
  }

  /** Отправить выписку партнёру (PDF + Excel) с подключённой почты отеля. */
  async send(tenantId: string, agencyId: string, q: { from?: string; to?: string; basis?: string; to_email?: string }) {
    const { buffer, name, statement } = await this.pdf(tenantId, agencyId, q);
    const to = (q.to_email || statement.partner.email || '').trim();
    if (!to) throw new BadRequestException('У партнёра нет email — укажите его в профиле');
    const x = await this.xlsx(tenantId, agencyId, q);
    await this.tenantMail.sendOrThrow(tenantId, {
      to,
      subject: `Statement ${statement.from} — ${statement.to} · ${statement.partner.name}`,
      html: `<p>Hello,</p><p>Please find attached the statement for ${statement.from} — ${statement.to}: ${statement.totals.bookings} bookings, ${statement.totals.roomNights} room nights.</p>`,
      attachments: [
        { filename: name, content: buffer.toString('base64') },
        { filename: x.name, content: x.buffer.toString('base64') },
      ],
    });
    return { ok: true, to };
  }
}
