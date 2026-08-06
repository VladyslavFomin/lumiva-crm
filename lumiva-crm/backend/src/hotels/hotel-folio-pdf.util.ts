import PDFDocument from 'pdfkit';
import { resolveUnicodePdfFont } from '../common/pdf-font.util';
import { HotelReservation } from './hotel-reservation.entity';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

/** Simple guest folio/invoice PDF — same Buffer-collection pdfkit pattern as
 * products.service.ts's renderPriceListPdf and esign-pdf.util.ts's renderEsignPdf. */
export function renderHotelFolioPdf(
  reservation: HotelReservation,
  hotel: Hotel | null,
  roomType: HotelRoomType | null,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4', autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const fontPath = resolveUnicodePdfFont();
    if (fontPath) doc.font(fontPath);

    const nights = nightsBetween(reservation.checkIn, reservation.checkOut);
    const paid = reservation.payments.reduce((s, p) => s + Number(p.amount), 0);
    const balanceDue = Number(reservation.total) - paid;

    doc.fontSize(18).text(hotel?.name || 'Отель', { align: 'left' });
    doc.fontSize(10).fillColor('#666').text('Счёт по брони', { align: 'left' });
    doc.moveDown(1.2);

    doc.fontSize(11).fillColor('#111');
    doc.text(`Гость: ${reservation.guestName}`);
    if (reservation.guestEmail) doc.text(`Email: ${reservation.guestEmail}`);
    if (reservation.guestPhone) doc.text(`Телефон: ${reservation.guestPhone}`);
    doc.moveDown(0.6);
    doc.text(`Тип номера: ${roomType?.name || '—'}`);
    doc.text(`Заезд: ${reservation.checkIn}    Выезд: ${reservation.checkOut}    Ночей: ${nights}`);
    doc.moveDown(1);

    doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor('#ddd').stroke();
    doc.moveDown(0.6);

    const row = (label: string, value: string, bold = false) => {
      doc.fontSize(bold ? 12 : 11).fillColor('#111');
      doc.text(label, 48, doc.y, { continued: true, width: 350 });
      doc.text(value, { align: 'right' });
    };
    row('Номер за весь период', `$${reservation.roomTotal}`);
    if (Number(reservation.discountPct) > 0) row('Скидка', `-${reservation.discountPct}%`);
    row('Итого', `$${Number(reservation.total).toFixed(2)}`, true);
    doc.moveDown(1);

    if (reservation.payments.length > 0) {
      doc.fontSize(11).fillColor('#111').text('Платежи', { underline: true });
      doc.moveDown(0.3);
      for (const p of reservation.payments) {
        doc.fontSize(10).fillColor('#333');
        doc.text(`${p.date}  ·  ${p.method}${p.note ? `  ·  ${p.note}` : ''}`, 48, doc.y, { continued: true, width: 400 });
        doc.text(`$${Number(p.amount).toFixed(2)}`, { align: 'right' });
      }
      doc.moveDown(1);
    }

    doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor('#ddd').stroke();
    doc.moveDown(0.6);
    doc.fontSize(13).fillColor(balanceDue > 0 ? '#cc2f47' : '#1f8a5e');
    doc.text('К оплате', 48, doc.y, { continued: true, width: 350 });
    doc.text(`$${balanceDue.toFixed(2)}`, { align: 'right' });

    doc.end();
  });
}
