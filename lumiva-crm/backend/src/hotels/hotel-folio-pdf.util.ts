import PDFDocument from 'pdfkit';
import { resolveUnicodePdfFont } from '../common/pdf-font.util';
import { HotelReservation } from './hotel-reservation.entity';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelFolioKind, HotelFolioLine } from './hotel-folio.entities';
import { folioSummary } from './hotel-folio.service';

export type FolioPdfLang = 'ru' | 'en' | 'tr';

const L: Record<FolioPdfLang, Record<string, string>> = {
  ru: {
    hotel: 'Отель', title: 'Счёт по брони', guestFolio: 'Гостевой счёт', partnerFolio: 'Счёт партнёра', guest: 'Гость', phone: 'Телефон', roomType: 'Тип номера',
    arrival: 'Заезд', departure: 'Выезд', nights: 'Ночей', code: 'Бронь', stay: 'Проживание', cancelFee: 'Штраф за отмену', noShowFee: 'Штраф за незаезд',
    discount: 'Скидка', exTax: 'Стоимость без налогов', accTax: 'Налог на проживание', vat: 'НДС', charges: 'Начисления', total: 'Итого', payments: 'Платежи',
    refund: 'возврат', due: 'К оплате', overpaid: 'Переплата', void: 'сторно', early_checkin: 'Ранний заезд', late_checkout: 'Поздний выезд',
    cash: 'Наличные', card: 'Карта', bank_transfer: 'Перевод', other: 'Другое', partner: 'Партнёр',
  },
  en: {
    hotel: 'Hotel', title: 'Reservation invoice', guestFolio: 'Guest folio', partnerFolio: 'Partner folio', guest: 'Guest', phone: 'Phone', roomType: 'Room type',
    arrival: 'Arrival', departure: 'Departure', nights: 'Nights', code: 'Booking', stay: 'Accommodation', cancelFee: 'Cancellation fee', noShowFee: 'No-show fee',
    discount: 'Discount', exTax: 'Amount excl. taxes', accTax: 'Accommodation tax', vat: 'VAT', charges: 'Charges', total: 'Total', payments: 'Payments',
    refund: 'refund', due: 'Balance due', overpaid: 'Overpaid', void: 'void', early_checkin: 'Early check-in', late_checkout: 'Late check-out',
    cash: 'Cash', card: 'Card', bank_transfer: 'Bank transfer', other: 'Other', partner: 'Partner',
  },
  tr: {
    hotel: 'Otel', title: 'Rezervasyon faturası', guestFolio: 'Misafir folyosu', partnerFolio: 'Partner folyosu', guest: 'Misafir', phone: 'Telefon', roomType: 'Oda tipi',
    arrival: 'Giriş', departure: 'Çıkış', nights: 'Gece', code: 'Rezervasyon', stay: 'Konaklama', cancelFee: 'İptal cezası', noShowFee: 'No-show cezası',
    discount: 'İndirim', exTax: 'Vergiler hariç tutar', accTax: 'Konaklama vergisi', vat: 'KDV', charges: 'Masraflar', total: 'Toplam', payments: 'Ödemeler',
    refund: 'iade', due: 'Ödenecek tutar', overpaid: 'Fazla ödeme', void: 'iptal', early_checkin: 'Erken giriş', late_checkout: 'Geç çıkış',
    cash: 'Nakit', card: 'Kart', bank_transfer: 'Havale', other: 'Diğer', partner: 'Partner',
  },
};

const LOCALE: Record<FolioPdfLang, string> = { ru: 'ru-RU', en: 'en-US', tr: 'tr-TR' };

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

/** Счёт брони (PDF) на языке гостя: проживание, налоги, начисления фолио (со сторно), платежи, остаток по счёту */
export function renderHotelFolioPdf(
  reservation: HotelReservation,
  hotel: Hotel | null,
  roomType: HotelRoomType | null,
  lines: HotelFolioLine[] = [],
  opts: { lang?: string; folio?: HotelFolioKind } = {},
): Promise<Buffer> {
  const lang: FolioPdfLang = opts.lang === 'en' || opts.lang === 'tr' ? opts.lang : 'ru';
  const t = L[lang];
  const folio: HotelFolioKind = opts.folio === 'partner' ? 'partner' : 'guest';
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4', autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    const fontPath = resolveUnicodePdfFont();
    if (fontPath) doc.font(fontPath);

    const summary = folioSummary(reservation, lines, hotel);
    const f = summary.folios[folio];
    const nights = nightsBetween(reservation.checkIn, reservation.checkOut);
    const cur = summary.currency;
    const m = (n: number | string) => `${Number(n).toLocaleString(LOCALE[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${cur ? ` ${cur}` : ''}`;
    const row = (label: string, value: string, opt: { bold?: boolean; color?: string; size?: number } = {}) => {
      doc.fontSize(opt.size || (opt.bold ? 12 : 10.5)).fillColor(opt.color || '#111');
      doc.text(label, 48, doc.y, { continued: true, width: 360 });
      doc.text(value, { align: 'right' });
    };
    const rule = () => {
      doc.moveDown(0.4);
      doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor('#ddd').stroke();
      doc.moveDown(0.5);
    };

    doc.fontSize(18).fillColor('#111').text(hotel?.name || t.hotel);
    doc.fontSize(10).fillColor('#666').text(`${t.title} · ${folio === 'partner' ? t.partnerFolio : t.guestFolio}`);
    doc.moveDown(1);
    doc.fontSize(10.5).fillColor('#111');
    if (reservation.bookingCode) doc.text(`${t.code}: ${reservation.bookingCode}`);
    doc.text(`${t.guest}: ${reservation.guestName}`);
    if (reservation.guestEmail) doc.text(`Email: ${reservation.guestEmail}`);
    if (reservation.guestPhone) doc.text(`${t.phone}: ${reservation.guestPhone}`);
    doc.text(`${t.roomType}: ${roomType?.name || '—'}`);
    doc.text(`${t.arrival}: ${reservation.checkIn}    ${t.departure}: ${reservation.checkOut}    ${t.nights}: ${nights}`);
    rule();

    if (summary.accommodationFolio === folio && summary.accommodation) {
      const closedLabel = reservation.status === 'cancelled' ? t.cancelFee : reservation.status === 'no_show' ? t.noShowFee : null;
      if (closedLabel) {
        row(closedLabel, m(summary.accommodation));
      } else {
        const tx = summary.taxes;
        const hasTax = tx.accommodationTaxPct > 0 || tx.vatPct > 0;
        const hasDiscount = Number(reservation.discountPct) > 0;
        // расшифровка нужна только при скидке или налогах — иначе одна строка «Проживание»
        if (hasTax || hasDiscount) {
          row(t.stay, m(reservation.roomTotal), { color: '#555' });
          if (hasDiscount) row(t.discount, `-${reservation.discountPct}%`, { color: '#555' });
          if (hasTax) {
            row(t.exTax, m(tx.base), { color: '#555' });
            if (tx.accommodationTaxPct > 0) row(`${t.accTax} ${tx.accommodationTaxPct}%`, m(tx.accommodationTax), { color: '#555' });
            if (tx.vatPct > 0) row(`${t.vat} ${tx.vatPct}%`, m(tx.vat), { color: '#555' });
          }
        }
        row(t.stay, m(summary.accommodation), { bold: true });
      }
      doc.moveDown(0.6);
    }

    const myLines = lines.filter((l) => (l.folio === 'partner' ? 'partner' : 'guest') === folio);
    if (myLines.length) {
      doc.fontSize(11).fillColor('#111').text(t.charges, { underline: true });
      doc.moveDown(0.3);
      for (const l of myLines) {
        const name = l.description || t[l.kind] || l.kind;
        const qty = Number(l.quantity) !== 1 ? ` × ${Number(l.quantity)}` : '';
        row(`${l.serviceDate}  ·  ${name}${qty}${l.voidOfId ? ` (${t.void})` : ''}`, m(l.amount), { color: l.voided || l.voidOfId ? '#999' : '#333' });
      }
      doc.moveDown(0.6);
    }
    row(t.total, m(f.charges), { bold: true });
    doc.moveDown(0.8);

    const pays = (reservation.payments || []).filter((p) => (p.folio === 'partner' ? 'partner' : 'guest') === folio);
    if (pays.length) {
      doc.fontSize(11).fillColor('#111').text(t.payments, { underline: true });
      doc.moveDown(0.3);
      for (const p of pays) {
        const method = t[p.method] || p.method;
        row(`${p.date}  ·  ${method}${Number(p.amount) < 0 ? ` (${t.refund})` : ''}${p.note ? `  ·  ${p.note}` : ''}`, m(p.amount), { color: '#333' });
      }
      doc.moveDown(0.6);
    }
    rule();
    row(f.balance >= 0 ? t.due : t.overpaid, m(Math.abs(f.balance)), { bold: true, size: 13, color: f.balance > 0.009 ? '#cc2f47' : '#1f8a5e' });
    doc.end();
  });
}
