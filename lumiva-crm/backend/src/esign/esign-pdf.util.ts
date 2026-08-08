// src/esign/esign-pdf.util.ts
import PDFDocument from 'pdfkit';
import { resolveUnicodePdfFont } from '../common/pdf-font.util';

export interface SignatureBlock {
  signerName: string;
  signedAt: Date;
  ip: string;
  userAgent: string;
}

export interface RenderedEsignPdf {
  buffer: Buffer;
  pageCount: number;
}

export function renderEsignPdf(title: string, bodyText: string, signature?: SignatureBlock): Promise<RenderedEsignPdf> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 56, size: 'A4', autoFirstPage: true, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('error', reject);

    const fontPath = resolveUnicodePdfFont();
    if (fontPath) doc.font(fontPath);

    doc.fontSize(18).text(title, { align: 'left' });
    doc.moveDown(1);
    doc.fontSize(11).fillColor('#111').text(bodyText, { align: 'left', lineGap: 4 });

    if (signature) {
      doc.moveDown(2);
      doc.moveTo(56, doc.y).lineTo(539, doc.y).strokeColor('#ddd').stroke();
      doc.moveDown(0.8);
      doc.fontSize(11).fillColor('#111').text('Подписано электронно', { continued: false });
      doc.moveDown(0.3);
      doc.fontSize(9).fillColor('#555');
      doc.text(`Подписал(а): ${signature.signerName}`);
      doc.text(`Дата и время: ${signature.signedAt.toLocaleString('ru-RU')}`);
      doc.text(`IP-адрес: ${signature.ip}`);
      doc.text(`Устройство: ${signature.userAgent}`);
      doc.moveDown(0.5);
      doc
        .fontSize(8)
        .fillColor('#888')
        .text(
          'Согласие подтверждено переходом по индивидуальной ссылке, отправленной на email подписанта, и нажатием кнопки «Подписать». Это является признанной формой электронной подписи по смыслу применимого законодательства об электронных документах.',
          { align: 'left' },
        );
    }

    // Must read the buffered range before .end() flushes it — the 'end' event fires
    // after the flush, at which point bufferedPageRange() has already reset to 0.
    const pageCount = doc.bufferedPageRange().count;
    doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), pageCount }));
    doc.end();
  });
}
