import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { Hotel } from '../hotels/hotel.entity';
import { MailService } from '../mail/mail.service';
import { escapeMailHtml, renderMailShell } from '../mail/mail-template.util';
import { resolveUnicodePdfFont } from '../common/pdf-font.util';
import { HotelBrand } from './reputation.entities';
import { REPLY_MODE, listParam } from './reputation.constants';
import { AnalyticsQuery, ReputationAnalyticsService } from './reputation-analytics.service';
import { ReputationReviewsService } from './reputation-reviews.service';
import { ReputationSettingsService } from './reputation-settings.service';
import { ReputationAiService } from './reputation-ai.service';
import { ReputationCompetitorsService } from './reputation-competitors.service';
import { tenantBranding } from './reputation-tenant.util';

export type ReportLang = 'ru' | 'en' | 'tr';
export interface ReportRequest extends AnalyticsQuery {
  lang?: string;
  /** Короткий вывод ИИ в начале отчёта (по цифрам отчёта, без выдумок). */
  aiSummary?: boolean;
}

// ---------------------------------------------------------------- тексты отчёта

const T: Record<ReportLang, Record<string, string>> = {
  ru: {
    kicker: 'Отчёт по репутации', allHotels: 'Все отели', platforms: 'Площадки', period: 'Период', vs: 'сравнение с', generated: 'Сформирован',
    kAvg: 'Средняя оценка', kIndex: 'Индекс репутации', kCount: 'Отзывов', kNeg: 'Доля негатива', kResp: 'Ответы на отзывы', kTime: 'Время ответа (медиана)',
    prevShort: 'к прошлому периоду', summary: 'Главное за период', trend: 'Динамика средней оценки', trendSub: 'Сплошная линия — выбранный период, пунктир — предыдущий такой же период',
    counts: 'Число отзывов', countsSub: 'Тёмные столбцы — выбранный период, светлые — предыдущий', current: 'Выбранный период', previous: 'Предыдущий период',
    cmpHotels: 'Сравнение отелей', cmpPlatforms: 'Сравнение площадок', cmpSub: 'Средняя оценка 0–10 по шагам периода',
    byPlatform: 'По площадкам', byHotel: 'По отелям', colPlatform: 'Площадка', colHotel: 'Отель', colCount: 'Отзывов', colAvg: 'Средняя', colDelta: 'Δ',
    colNeg: 'Негатив', colResp: 'Ответы', colIndex: 'Индекс', colOpen: 'Без ответа', pp: ' п.п.', colTop: 'Главная жалоба', colOnPlatform: 'На площадке',
    complaints: 'На что жалуются', praises: 'Что хвалят', quotes: 'Цитаты гостей', countries: 'Страны гостей',
    countriesSub: 'Страна из профиля гостя (Booking), иначе — по языку отзыва', colCountry: 'Страна',
    open: 'Негативные отзывы без ответа', none: 'Нет данных за период', page: 'стр.', hours: 'ч', minutes: 'мин', days: 'дн',
    xen: 'Англоязычные страны', xar: 'Арабские страны', noReply: 'не публикует ответы',
    compTitle: 'Конкуренты', compSub: 'Средняя за период на одних и тех же площадках: {p}', compUs: 'Мы', compRank: 'Место по средней: {r} из {n}', compLose: 'Проигрываем', compWin: 'Выигрываем', compTopicNote: 'Полоса — разрыв в п.п.; в подписи — доля отзывов с жалобой или похвалой: у нас / у конкурентов', compComplaints: 'жалобы', compPraise: 'похвала', compFew: 'Для сравнения тем мало разобранных отзывов (нужно от {n} с каждой стороны)', colOnSite: 'Рейтинг на площадке',
    mailSubject: 'Отчёт по репутации', mailText: 'Во вложении — PDF-отчёт по отзывам за период', mailOpen: 'Открыть дашборд',
  },
  en: {
    kicker: 'Reputation report', allHotels: 'All hotels', platforms: 'Platforms', period: 'Period', vs: 'compared with', generated: 'Generated',
    kAvg: 'Average rating', kIndex: 'Reputation index', kCount: 'Reviews', kNeg: 'Negative share', kResp: 'Response rate', kTime: 'Reply time (median)',
    prevShort: 'vs previous period', summary: 'Key takeaways', trend: 'Average rating trend', trendSub: 'Solid line — selected period, dashed — the previous period of the same length',
    counts: 'Number of reviews', countsSub: 'Dark bars — selected period, light — previous period', current: 'Selected period', previous: 'Previous period',
    cmpHotels: 'Hotel comparison', cmpPlatforms: 'Platform comparison', cmpSub: 'Average rating 0–10 per step of the period',
    byPlatform: 'By platform', byHotel: 'By hotel', colPlatform: 'Platform', colHotel: 'Hotel', colCount: 'Reviews', colAvg: 'Average', colDelta: 'Δ',
    colNeg: 'Negative', colResp: 'Replied', colIndex: 'Index', colOpen: 'Unanswered', pp: ' pp', colTop: 'Top complaint', colOnPlatform: 'On platform',
    complaints: 'What guests complain about', praises: 'What guests praise', quotes: 'Guest quotes', countries: 'Guest countries',
    countriesSub: 'Country from the guest profile (Booking), otherwise by review language', colCountry: 'Country',
    open: 'Unanswered negative reviews', none: 'No data for the period', page: 'p.', hours: 'h', minutes: 'min', days: 'd',
    xen: 'English-speaking countries', xar: 'Arabic-speaking countries', noReply: 'no public replies',
    compTitle: 'Competitors', compSub: 'Average for the period on the same platforms: {p}', compUs: 'Us', compRank: 'Rank by average: {r} of {n}', compLose: 'Where we lose', compWin: 'Where we win', compTopicNote: 'Bar — gap in pp; label — share of reviews complaining or praising: us / competitors', compComplaints: 'complaints', compPraise: 'praise', compFew: 'Too few analysed reviews to compare topics ({n}+ needed on each side)', colOnSite: 'Platform rating',
    mailSubject: 'Reputation report', mailText: 'Attached is the PDF review report for the period', mailOpen: 'Open dashboard',
  },
  tr: {
    kicker: 'İtibar raporu', allHotels: 'Tüm oteller', platforms: 'Platformlar', period: 'Dönem', vs: 'karşılaştırma', generated: 'Oluşturuldu',
    kAvg: 'Ortalama puan', kIndex: 'İtibar endeksi', kCount: 'Yorum', kNeg: 'Olumsuz oranı', kResp: 'Yanıt oranı', kTime: 'Yanıt süresi (medyan)',
    prevShort: 'önceki döneme göre', summary: 'Dönemin özeti', trend: 'Ortalama puan dinamiği', trendSub: 'Düz çizgi — seçilen dönem, kesikli — aynı uzunluktaki önceki dönem',
    counts: 'Yorum sayısı', countsSub: 'Koyu sütunlar — seçilen dönem, açık — önceki dönem', current: 'Seçilen dönem', previous: 'Önceki dönem',
    cmpHotels: 'Otel karşılaştırması', cmpPlatforms: 'Platform karşılaştırması', cmpSub: 'Dönem adımlarına göre ortalama puan 0–10',
    byPlatform: 'Platformlara göre', byHotel: 'Otellere göre', colPlatform: 'Platform', colHotel: 'Otel', colCount: 'Yorum', colAvg: 'Ortalama', colDelta: 'Δ',
    colNeg: 'Olumsuz', colResp: 'Yanıt', colIndex: 'Endeks', colOpen: 'Yanıtsız', pp: ' puan', colTop: 'Başlıca şikâyet', colOnPlatform: 'Platformda',
    complaints: 'Misafirler neden şikâyet ediyor', praises: 'Misafirler neyi övüyor', quotes: 'Misafir alıntıları', countries: 'Misafir ülkeleri',
    countriesSub: 'Ülke misafir profilinden (Booking), aksi halde yorum diline göre', colCountry: 'Ülke',
    open: 'Yanıtsız olumsuz yorumlar', none: 'Bu dönem için veri yok', page: 's.', hours: 'sa', minutes: 'dk', days: 'gün',
    xen: 'İngilizce konuşulan ülkeler', xar: 'Arapça konuşulan ülkeler', noReply: 'yanıt yayınlanmıyor',
    compTitle: 'Rakipler', compSub: 'Aynı platformlarda dönem ortalaması: {p}', compUs: 'Biz', compRank: 'Ortalamaya göre sıra: {r} / {n}', compLose: 'Geride olduğumuz konular', compWin: 'Önde olduğumuz konular', compTopicNote: 'Çubuk — puan farkı; etikette — şikâyet veya övgü içeren yorumların payı: biz / rakipler', compComplaints: 'şikâyet', compPraise: 'övgü', compFew: 'Konuları karşılaştırmak için yeterli analiz edilmiş yorum yok (her iki tarafta {n}+ gerekli)', colOnSite: 'Platform puanı',
    mailSubject: 'İtibar raporu', mailText: 'Dönemin yorum raporu PDF olarak ektedir', mailOpen: 'Panoyu aç',
  },
};

/** Подписи, когда сравниваем с тем же периодом прошлого года (сезонные отели). */
const YOY: Record<ReportLang, Record<string, string>> = {
  ru: { yoyPartial: 'Внимание: за тот же период год назад в CRM {prev} отзывов против {cur} сейчас — история прошлого года загружена не полностью. Изменение количества отзывов не показательно, средняя год назад посчитана по неполной выборке.', vs: 'сравнение с тем же периодом год назад:', prevShort: 'к прошлому году', previous: 'Год назад', trendSub: 'Сплошная линия — выбранный период, пунктир — тот же период год назад', countsSub: 'Тёмные столбцы — выбранный период, светлые — год назад' },
  en: { yoyPartial: 'Note: the CRM has {prev} reviews for the same period a year ago vs {cur} now — last year’s history is only partly loaded. The change in review count is not meaningful, and last year’s average is based on an incomplete sample.', vs: 'compared with the same period a year ago:', prevShort: 'vs last year', previous: 'A year ago', trendSub: 'Solid line — selected period, dashed — the same period a year ago', countsSub: 'Dark bars — selected period, light — a year ago' },
  tr: { yoyPartial: 'Dikkat: CRM’de geçen yılın aynı dönemi için {prev} yorum var, şimdi {cur} — geçen yılın geçmişi tam yüklenmedi. Yorum sayısındaki değişim anlamlı değil, geçen yılın ortalaması eksik örneğe dayanıyor.', vs: 'geçen yılın aynı dönemiyle karşılaştırma:', prevShort: 'geçen yıla göre', previous: 'Bir yıl önce', trendSub: 'Düz çizgi — seçilen dönem, kesikli — bir yıl önceki aynı dönem', countsSub: 'Koyu sütunlar — seçilen dönem, açık — bir yıl önce' },
};

const TOPICS: Record<ReportLang, Record<string, string>> = {
  ru: { cleanliness: 'уборка', room: 'номер', bed_sleep: 'кровать и сон', noise: 'шум', breakfast: 'завтрак', food: 'ресторан и еда', bar: 'бар', all_inclusive: 'all inclusive', pool: 'бассейн', beach: 'пляж', animation: 'анимация', staff: 'персонал', reception: 'ресепшн и заселение', wifi: 'Wi-Fi', air_conditioning: 'кондиционер', value: 'цена и ценность', location: 'расположение', transfer: 'трансфер', spa: 'спа', kids_club: 'детский клуб', other: 'прочее' },
  en: { cleanliness: 'cleanliness', room: 'room', bed_sleep: 'bed & sleep', noise: 'noise', breakfast: 'breakfast', food: 'restaurant & food', bar: 'bar', all_inclusive: 'all inclusive', pool: 'pool', beach: 'beach', animation: 'entertainment', staff: 'staff', reception: 'reception & check-in', wifi: 'Wi-Fi', air_conditioning: 'air conditioning', value: 'price & value', location: 'location', transfer: 'transfer', spa: 'spa', kids_club: 'kids club', other: 'other' },
  tr: { cleanliness: 'temizlik', room: 'oda', bed_sleep: 'yatak ve uyku', noise: 'gürültü', breakfast: 'kahvaltı', food: 'restoran ve yemek', bar: 'bar', all_inclusive: 'her şey dahil', pool: 'havuz', beach: 'plaj', animation: 'animasyon', staff: 'personel', reception: 'resepsiyon ve giriş', wifi: 'Wi-Fi', air_conditioning: 'klima', value: 'fiyat ve değer', location: 'konum', transfer: 'transfer', spa: 'spa', kids_club: 'çocuk kulübü', other: 'diğer' },
};

const PLATFORM_LABEL: Record<string, string> = {
  google: 'Google', holidaycheck: 'HolidayCheck', tripadvisor: 'Tripadvisor', yandex: 'Yandex', expedia: 'Expedia', check24: 'Check24', otelpuan: 'Otelpuan', booking: 'Booking.com',
};
const PLATFORM_COLOR: Record<string, string> = {
  google: '#4285F4', holidaycheck: '#0b3f9c', tripadvisor: '#00AF87', yandex: '#FC3F1D', expedia: '#d9a400', check24: '#063773', otelpuan: '#e2231a', booking: '#003580',
};

// ---------------------------------------------------------------- оформление

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 40;
const CW = PAGE_W - M * 2;
const BOTTOM = PAGE_H - 46;
const INK = '#16181d';
const MUTED = '#6b6f78';
const FAINT = '#a3a7b0';
const LINE = '#e6e7eb';
const SOFT = '#f5f6f8';
const GOOD = '#1f8a5e';
const BAD = '#cc2f47';
const PREV = '#b9bcc4';
const SERIES = ['#16181d', '#2f6fde', '#d9822b', '#1f8a5e', '#9b4dca', '#cc2f47', '#0f9fb0', '#8a6d3b'];

function fontsDir(): string | null {
  for (const d of [join(process.cwd(), 'assets/fonts'), join(__dirname, '../../assets/fonts'), join(__dirname, '../../../assets/fonts')]) {
    if (existsSync(join(d, 'Inter_400Regular.ttf'))) return d;
  }
  return null;
}

type Delta = { v: number | null; good: 'up' | 'down' | 'none'; digits: number; suffix?: string };

/** Один отчёт = один документ: ведёт текущую позицию y, переносит блоки на новую страницу целиком. */
class ReportPdf {
  doc: PDFKit.PDFDocument;
  y = M;
  private readonly loc: string;

  /** brand — название клиента (тенанта): в шапке, колонтитуле и свойствах файла, не Lumiva. */
  constructor(readonly t: Record<string, string>, readonly lang: ReportLang, readonly brand: string) {
    this.loc = lang === 'en' ? 'en-GB' : lang === 'tr' ? 'tr-TR' : 'ru-RU';
    this.doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, info: { Title: `${t.kicker} · ${brand}`, Author: brand, Producer: brand, Creator: brand } });
    const dir = fontsDir();
    const fallback = resolveUnicodePdfFont();
    const reg = (name: string, file: string) => {
      if (dir) this.doc.registerFont(name, join(dir, file));
      else if (fallback) this.doc.registerFont(name, fallback);
    };
    reg('R', 'Inter_400Regular.ttf');
    reg('M', 'Inter_500Medium.ttf');
    reg('SB', 'Inter_600SemiBold.ttf');
    reg('B', 'Inter_700Bold.ttf');
    this.doc.font('R');
  }

  num(v: number | null | undefined, d = 2) {
    if (v == null || !Number.isFinite(v)) return '—';
    return new Intl.NumberFormat(this.loc, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  }
  date(iso: string | Date) {
    return new Date(iso).toLocaleDateString(this.loc, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
  }
  hours(h: number | null | undefined) {
    if (h == null) return '—';
    if (h < 1) return `${Math.max(1, Math.round(h * 60))} ${this.t.minutes}`;
    if (h < 48) return `${this.num(h, h < 10 ? 1 : 0)} ${this.t.hours}`;
    return `${this.num(h / 24, 1)} ${this.t.days}`;
  }

  text(s: string, x: number, y: number, o: { size?: number; font?: string; color?: string; width?: number; align?: 'left' | 'right' | 'center'; lineGap?: number; height?: number; opacity?: number } = {}) {
    this.doc
      .font(o.font || 'R')
      .fontSize(o.size || 9)
      .fillColor(o.color || INK, o.opacity ?? 1)
      .text(s, x, y, { width: o.width, align: o.align || 'left', lineGap: o.lineGap ?? 1, height: o.height, ellipsis: o.height ? true : undefined, lineBreak: o.width != null });
    this.doc.fillOpacity(1);
  }
  heightOf(s: string, width: number, size = 9, font = 'R', lineGap = 1) {
    return this.doc.font(font).fontSize(size).heightOfString(s, { width, lineGap });
  }

  /** Блок высотой h не помещается — новая страница. */
  ensure(h: number) {
    if (this.y + h > BOTTOM) {
      this.doc.addPage({ size: 'A4', margin: 0 });
      this.y = M;
    }
  }

  section(title: string, sub?: string, need = 120) {
    this.ensure(need);
    this.y += 10;
    this.text(title, M, this.y, { size: 13, font: 'B' });
    this.y += 19;
    if (sub) {
      this.text(sub, M, this.y, { size: 8.5, color: MUTED, width: CW });
      this.y += this.heightOf(sub, CW, 8.5) + 6;
    }
  }

  header(title: string, lines: string[], generated: string) {
    const d = this.doc;
    const h = 118 + Math.max(0, lines.length - 2) * 13;
    d.rect(0, 0, PAGE_W, h).fill('#14161b');
    // тонкая полоса-акцент
    d.rect(0, h - 3, PAGE_W, 3).fill('#2f6fde');
    const brand = this.brand.toUpperCase().slice(0, 60);
    const bw = this.doc.font('B').fontSize(8).widthOfString(brand);
    this.text(brand, M, 30, { size: 8, font: 'B', color: '#ffffff', opacity: 0.55 });
    this.text(this.t.kicker.toUpperCase(), M + bw + 18, 30, { size: 8, font: 'SB', color: '#ffffff', opacity: 0.55 });
    this.text(`${this.t.generated}: ${generated}`, M, 30, { size: 8, color: '#ffffff', opacity: 0.55, width: CW, align: 'right' });
    this.text(title, M, 50, { size: 22, font: 'B', color: '#ffffff', width: CW, height: 30 });
    let y = 82;
    for (const l of lines) {
      this.text(l, M, y, { size: 9.5, color: '#d4d6dc', width: CW, height: 13 });
      y += 13;
    }
    this.y = h + 22;
  }

  deltaText(dl: Delta): { s: string; color: string } | null {
    if (dl.v == null || !Number.isFinite(dl.v)) return null;
    const flat = Math.abs(dl.v) < 1e-9;
    const goodDir = dl.good === 'none' ? null : (dl.v > 0) === (dl.good === 'up');
    const color = flat || goodDir == null ? MUTED : goodDir ? GOOD : BAD;
    const arrow = flat ? '±' : dl.v > 0 ? '▲ +' : '▼ −';
    return { s: `${arrow}${this.num(Math.abs(dl.v), dl.digits)}${dl.suffix || ''}`, color };
  }

  kpis(cards: Array<{ label: string; value: string; unit?: string; delta: Delta }>) {
    const cols = 3;
    const gap = 10;
    const w = (CW - gap * (cols - 1)) / cols;
    const h = 70;
    this.ensure(h * 2 + gap);
    cards.forEach((c, i) => {
      const x = M + (i % cols) * (w + gap);
      const y = this.y + Math.floor(i / cols) * (h + gap);
      this.doc.roundedRect(x, y, w, h, 9).fill(SOFT);
      this.text(c.label.toUpperCase(), x + 12, y + 11, { size: 7, font: 'SB', color: MUTED, width: w - 24, height: 10 });
      const vw = this.doc.font('B').fontSize(20).widthOfString(c.value);
      this.text(c.value, x + 12, y + 25, { size: 20, font: 'B' });
      if (c.unit) this.text(c.unit, x + 14 + vw, y + 33, { size: 9, color: MUTED });
      const dl = this.deltaText(c.delta);
      if (dl) {
        this.text(dl.s, x + 12, y + 52, { size: 8, font: 'SB', color: dl.color });
        const dw = this.doc.font('SB').fontSize(8).widthOfString(dl.s);
        this.text(this.t.prevShort, x + 16 + dw, y + 52, { size: 7.5, color: FAINT, width: w - dw - 30, height: 10 });
      }
    });
    this.y += Math.ceil(cards.length / cols) * (h + gap) + 4;
  }

  note(s: string) {
    const h = this.heightOf(s, CW - 28, 9.5, 'R', 2.5) + 22;
    this.ensure(h + 8);
    this.doc.roundedRect(M, this.y, CW, h, 9).fill('#eef3fc');
    this.doc.rect(M, this.y, 3, h).fill('#2f6fde');
    this.text(s, M + 16, this.y + 11, { size: 9.5, width: CW - 28, lineGap: 2.5 });
    this.y += h + 8;
  }

  /** Линии 0–10 по шагам; null — разрыв линии. */
  lineChart(labels: string[], series: Array<{ values: Array<number | null>; color: string; dashed?: boolean; width?: number }>, h = 150, negBelow?: number) {
    this.ensure(h + 20);
    const d = this.doc;
    const x0 = M + 26;
    const x1 = M + CW - 6;
    const y0 = this.y + 6;
    const y1 = this.y + h - 18;
    const all = series.flatMap((s) => s.values).filter((v): v is number => v != null);
    if (!all.length) {
      this.text(this.t.none, M, this.y + 10, { size: 9, color: FAINT });
      this.y += 34;
      return;
    }
    // масштаб по данным (порог негатива — линией, только если попадает в диапазон)
    const lo = Math.max(0, Math.floor((Math.min(...all) - 0.3) * 2) / 2);
    const hi = Math.min(10, Math.ceil((Math.max(...all) + 0.2) * 2) / 2);
    const yOf = (v: number) => y1 - ((v - lo) / Math.max(0.1, hi - lo)) * (y1 - y0);
    const n = labels.length;
    const xOf = (i: number) => (n > 1 ? x0 + (i / (n - 1)) * (x1 - x0) : (x0 + x1) / 2);
    for (const g of [lo, (lo + hi) / 2, hi]) {
      d.moveTo(x0, yOf(g)).lineTo(x1, yOf(g)).lineWidth(0.6).strokeColor(LINE).stroke();
      this.text(this.num(g, 1), M, yOf(g) - 4, { size: 7, color: FAINT });
    }
    if (negBelow != null && negBelow > lo && negBelow < hi) {
      d.moveTo(x0, yOf(negBelow)).lineTo(x1, yOf(negBelow)).lineWidth(0.7).dash(2, { space: 3 }).strokeColor(BAD).strokeOpacity(0.5).stroke();
      d.undash().strokeOpacity(1);
    }
    for (const s of series) {
      let pen = false;
      s.values.forEach((v, i) => {
        if (v == null) {
          pen = false;
          return;
        }
        if (!pen) d.moveTo(xOf(i), yOf(v));
        else d.lineTo(xOf(i), yOf(v));
        pen = true;
      });
      if (s.dashed) d.dash(3, { space: 3 });
      d.lineWidth(s.width ?? 1.8).lineJoin('round').strokeColor(s.color).stroke();
      d.undash();
      if (n <= 40) {
        s.values.forEach((v, i) => {
          if (v != null && !s.dashed) d.circle(xOf(i), yOf(v), 2).fill(s.color);
        });
      }
    }
    const every = Math.max(1, Math.ceil(n / 10));
    labels.forEach((l, i) => {
      if (i % every === 0) this.text(l, xOf(i) - 20, y1 + 6, { size: 7, color: FAINT, width: 40, align: 'center' });
    });
    this.y += h;
  }

  /** Столбцы: текущий период тёмный, предыдущий светлый рядом. */
  barChart(labels: string[], cur: number[], prev: number[] | null, h = 96) {
    this.ensure(h + 16);
    const d = this.doc;
    const x0 = M + 26;
    const x1 = M + CW - 6;
    const yTop = this.y + 4;
    const yBase = this.y + h - 18;
    const max = Math.max(1, ...cur, ...(prev || []));
    const n = Math.max(1, cur.length);
    const step = (x1 - x0) / n;
    const pair = prev ? 2 : 1;
    const bw = Math.max(1.2, Math.min(14, (step - 2) / pair));
    d.moveTo(x0, yBase).lineTo(x1, yBase).lineWidth(0.6).strokeColor(LINE).stroke();
    this.text(String(max), M, yTop - 2, { size: 7, color: FAINT });
    cur.forEach((v, i) => {
      const x = x0 + i * step + (step - bw * pair) / 2;
      if (prev) {
        const ph = ((prev[i] || 0) / max) * (yBase - yTop);
        if (ph > 0) d.rect(x, yBase - ph, bw, ph).fill(PREV);
      }
      const ch = (v / max) * (yBase - yTop);
      if (ch > 0) d.rect(x + (prev ? bw : 0), yBase - ch, bw, ch).fill(INK);
    });
    const every = Math.max(1, Math.ceil(n / 10));
    labels.forEach((l, i) => {
      if (i % every === 0) this.text(l, x0 + i * step + step / 2 - 20, yBase + 5, { size: 7, color: FAINT, width: 40, align: 'center' });
    });
    this.y += h;
  }

  legend(items: Array<{ label: string; color: string; dashed?: boolean; extra?: string }>) {
    let x = M;
    let y = this.y;
    for (const it of items) {
      const label = it.extra ? `${it.label} · ${it.extra}` : it.label;
      const w = this.doc.font('R').fontSize(8).widthOfString(label) + 26;
      if (x + w > M + CW) {
        x = M;
        y += 14;
      }
      if (it.dashed) this.doc.dash(2, { space: 2 });
      this.doc.moveTo(x, y + 5).lineTo(x + 14, y + 5).lineWidth(2).strokeColor(it.color).stroke();
      this.doc.undash();
      this.text(label, x + 18, y + 1, { size: 8, color: MUTED });
      x += w + 6;
    }
    this.y = y + 18;
  }

  table(cols: Array<{ label: string; w: number; align?: 'left' | 'right' }>, rows: Array<Array<string | { s: string; color?: string; font?: string; bar?: number }>>) {
    const total = cols.reduce((a, c) => a + c.w, 0);
    const ws = cols.map((c) => (c.w / total) * CW);
    const rowH = 19;
    const head = () => {
      let x = M;
      cols.forEach((c, i) => {
        this.text(c.label.toUpperCase(), x + 4, this.y + 5, { size: 6.8, font: 'SB', color: MUTED, width: ws[i] - 8, align: c.align || 'left', height: 9 });
        x += ws[i];
      });
      this.doc.moveTo(M, this.y + rowH - 2).lineTo(M + CW, this.y + rowH - 2).lineWidth(0.8).strokeColor(INK).stroke();
      this.y += rowH;
    };
    this.ensure(rowH * Math.min(rows.length + 1, 4));
    head();
    rows.forEach((r, ri) => {
      if (this.y + rowH > BOTTOM) {
        this.ensure(BOTTOM);
        head();
      }
      if (ri % 2 === 1) this.doc.rect(M, this.y - 1, CW, rowH).fill('#fafafb');
      let x = M;
      r.forEach((cell, i) => {
        const c: { s: string; color?: string; font?: string; bar?: number } = typeof cell === 'string' ? { s: cell } : cell;
        if (c.bar != null) {
          const bw = ws[i] - 12;
          this.doc.roundedRect(x + 6, this.y + 6.5, bw, 5, 2.5).fill(SOFT);
          if (c.bar > 0) this.doc.roundedRect(x + 6, this.y + 6.5, Math.max(3, c.bar * bw), 5, 2.5).fill(c.color || INK);
          x += ws[i];
          return;
        }
        this.text(c.s, x + 4, this.y + 4, { size: 8.3, font: c.font || (i === 0 ? 'M' : 'R'), color: c.color || INK, width: ws[i] - 8, align: cols[i].align || 'left', height: 11 });
        x += ws[i];
      });
      this.doc.moveTo(M, this.y + rowH - 1).lineTo(M + CW, this.y + rowH - 1).lineWidth(0.5).strokeColor(LINE).stroke();
      this.y += rowH;
    });
    this.y += 6;
  }

  /** Две колонки горизонтальных полос (жалобы | похвалы). */
  twoBars(left: { title: string; color: string; rows: Array<{ label: string; v: number; extra?: { s: string; color: string } | null }> }, right: typeof left) {
    const colW = (CW - 24) / 2;
    const rowH = 17;
    const n = Math.max(left.rows.length, right.rows.length, 1);
    this.ensure(30 + n * rowH);
    const top = this.y;
    for (const [i, side] of [left, right].entries()) {
      const x = M + i * (colW + 24);
      let y = top;
      this.text(side.title, x, y, { size: 10.5, font: 'SB', color: side.color });
      y += 18;
      if (!side.rows.length) this.text(this.t.none, x, y, { size: 8.5, color: FAINT });
      const max = Math.max(1, ...side.rows.map((r) => r.v));
      for (const r of side.rows) {
        const lw = colW * 0.42;
        this.text(r.label, x, y + 2, { size: 8.3, width: lw - 4, height: 11 });
        const bx = x + lw;
        const bwMax = colW - lw - 62;
        this.doc.roundedRect(bx, y + 4, bwMax, 6, 3).fill(SOFT);
        this.doc.roundedRect(bx, y + 4, Math.max(3, (r.v / max) * bwMax), 6, 3).fill(side.color);
        this.text(String(r.v), bx + bwMax + 6, y + 1.5, { size: 8.3, font: 'SB', width: 22, align: 'right' });
        if (r.extra) this.text(r.extra.s, bx + bwMax + 30, y + 2.5, { size: 7, color: r.extra.color, width: 30 });
        y += rowH;
      }
    }
    this.y = top + 22 + n * rowH + 6;
  }

  quote(text: string, meta: string) {
    const s = `«${text}»`;
    const h = this.heightOf(s, CW - 22, 9, 'R', 2) + this.heightOf(meta, CW - 22, 7.5) + 14;
    this.ensure(h + 6);
    this.doc.rect(M, this.y, 2, h - 4).fill(LINE);
    this.text(s, M + 12, this.y + 2, { size: 9, width: CW - 22, lineGap: 2 });
    this.text(meta, M + 12, this.y + h - this.heightOf(meta, CW - 22, 7.5) - 6, { size: 7.5, color: FAINT, width: CW - 22 });
    this.y += h + 4;
  }

  footer(left: string) {
    const range = this.doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      this.doc.switchToPage(i);
      this.doc.moveTo(M, PAGE_H - 30).lineTo(M + CW, PAGE_H - 30).lineWidth(0.5).strokeColor(LINE).stroke();
      this.text(left, M, PAGE_H - 24, { size: 7, color: FAINT, width: CW - 60, height: 10 });
      this.text(`${this.t.page} ${i - range.start + 1} / ${range.count}`, M, PAGE_H - 24, { size: 7, color: FAINT, width: CW, align: 'right' });
    }
  }

  finish(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      this.doc.on('data', (c: Buffer) => chunks.push(c));
      this.doc.on('error', reject);
      this.doc.on('end', () => resolve(Buffer.concat(chunks)));
      this.doc.end();
    });
  }
}

/** PDF-отчёт по репутации: фильтры дашборда (бренды/отели/площадки/период) на выбранном языке; скачать или отправить на почту. */
@Injectable()
export class ReputationReportService {
  private readonly log = new Logger(ReputationReportService.name);

  constructor(
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelBrand) private readonly brands: Repository<HotelBrand>,
    private readonly analytics: ReputationAnalyticsService,
    private readonly reviews: ReputationReviewsService,
    private readonly settings: ReputationSettingsService,
    private readonly ai: ReputationAiService,
    private readonly mail: MailService,
    private readonly competitors: ReputationCompetitorsService,
  ) {}

  private lang(v?: string): ReportLang {
    return v === 'en' || v === 'tr' ? v : 'ru';
  }

  async build(tenantId: string, req: ReportRequest): Promise<{ buffer: Buffer; filename: string; title: string; period: string }> {
    const lang = this.lang(req.lang);
    const t = req.compare === 'yoy' ? { ...T[lang], ...YOY[lang] } : T[lang];
    const q: AnalyticsQuery = { brandId: req.brandId, hotelId: req.hotelId, platform: req.platform, from: req.from, to: req.to, all: req.all, compare: req.compare === 'yoy' ? 'yoy' : undefined };
    const cfg = await this.settings.config(tenantId);
    const negBelow = cfg.thresholds.negativeBelow;
    const hotelIds = listParam(q.hotelId, 'uuid');
    const brandIds = listParam(q.brandId, 'uuid');
    const platforms = listParam(q.platform, 'platform');
    const dash: any = await this.analytics.dashboard(tenantId, q);
    const [cmpHotels, cmpPlatforms] = await Promise.all([
      hotelIds.length > 1 ? this.analytics.compare(tenantId, q, 'hotel') : null,
      platforms.length > 1 ? this.analytics.compare(tenantId, q, 'platform') : null,
    ]);
    const negLimit = (negBelow - 0.01).toFixed(2);
    const open = await this.reviews.feed(tenantId, {
      brandId: q.brandId, hotelId: q.hotelId, platform: q.platform,
      from: dash.period.from.slice(0, 10), reply: 'none', ratingMax: negLimit, limit: '8', sort: 'new',
    } as any);
    const allHotels = await this.hotels.find({ where: { tenantId } });
    const hotelName = (id: string) => allHotels.find((h) => h.id === id)?.name || '—';
    const topicName = (tp: { topic: string; label?: string | null }) => {
      if (tp.topic === 'other') return tp.label || TOPICS[lang].other;
      const extra = cfg.topicsExtra.find((x) => x.key === tp.topic);
      return TOPICS[lang][tp.topic] || extra?.translations?.[lang] || extra?.label || tp.label || tp.topic;
    };
    const regionNames = (() => {
      try {
        return new Intl.DisplayNames([lang], { type: 'region' });
      } catch {
        return null;
      }
    })();
    const countryName = (code: string) => (code === 'x-en' ? t.xen : code === 'x-ar' ? t.xar : regionNames?.of(code) || code);

    // заголовок: что именно в отчёте
    let title = t.allHotels;
    if (hotelIds.length) {
      const names = hotelIds.map(hotelName);
      title = names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3}` : names.join(', ');
    } else if (brandIds.length) {
      const bs = await this.brands.find({ where: { tenantId, id: In(brandIds) } });
      title = bs.map((b) => b.name).join(', ') || t.allHotels;
    }
    const branding = await tenantBranding((sql, p) => this.hotels.query(sql, p), tenantId);
    const brandName = branding.name?.trim() || 'Lumiva CRM';
    const pdf = new ReportPdf(t, lang, brandName);
    const periodTo = new Date(new Date(dash.period.to).getTime() - 864e5);
    const prevTo = new Date(new Date(dash.prevPeriod.to).getTime() - 864e5);
    const periodLine = `${t.period}: ${pdf.date(dash.period.from)} — ${pdf.date(periodTo)}  ·  ${t.vs} ${pdf.date(dash.prevPeriod.from)} — ${pdf.date(prevTo)}`;
    const lines = [periodLine];
    if (platforms.length) lines.push(`${t.platforms}: ${platforms.map((p) => PLATFORM_LABEL[p] || p).join(', ')}`);
    if (hotelIds.length > 3) lines.push(hotelIds.map(hotelName).join(', ').slice(0, 220));
    pdf.header(title, lines, pdf.date(new Date()));

    const k = dash.kpis;
    // год назад отзывов в CRM заметно меньше — история загружена не полностью, количество сравнивать нельзя
    if (q.compare === 'yoy' && k.count > 0 && k.delta && k.count - k.delta.count < k.count * 0.5) {
      pdf.note(t.yoyPartial.replace('{prev}', String(k.count - k.delta.count)).replace('{cur}', String(k.count)));
    }
    pdf.kpis([
      { label: t.kAvg, value: pdf.num(k.avg10), unit: '/ 10', delta: { v: k.delta?.avg10, good: 'up', digits: 2 } },
      { label: t.kIndex, value: pdf.num(k.reputationIndex, 1), unit: '/ 100', delta: { v: k.delta?.reputationIndex, good: 'up', digits: 1 } },
      { label: t.kCount, value: String(k.count), delta: { v: k.delta?.count, good: 'none', digits: 0 } },
      { label: t.kNeg, value: pdf.num(k.negativeShare, 1), unit: '%', delta: { v: k.delta?.negativeShare, good: 'down', digits: 1, suffix: t.pp } },
      { label: t.kResp, value: pdf.num(k.responseRate, 1), unit: '%', delta: { v: k.delta?.responseRate, good: 'up', digits: 1, suffix: t.pp } },
      { label: t.kTime, value: pdf.hours(k.medianReplyHours), delta: { v: k.delta?.medianReplyHours, good: 'down', digits: 1, suffix: ` ${t.hours}` } },
    ]);

    if (req.aiSummary !== false && k.count) {
      const summary = await this.ai.monthlySummary(tenantId, lang, {
        period: { from: dash.period.from.slice(0, 10), to: periodTo.toISOString().slice(0, 10) },
        scope: title,
        kpis: { avg10: k.avg10, index0to100: k.reputationIndex, reviews: k.count, negativeSharePct: k.negativeShare, responseRatePct: k.responseRate },
        [q.compare === 'yoy' ? 'changeVsSamePeriodLastYear' : 'changeVsPreviousPeriod']: k.delta,
        topComplaints: dash.complaints.slice(0, 5).map((c: any) => ({ topic: topicName(c), negative: c.negative, prev: c.prevNegative })),
        // готовые выборки — модель не должна сама сортировать таблицу (путала цифры)
        hotelsMostUnansweredNegative: [...dash.byHotel].filter((h: any) => h.openNegative > 0).sort((a: any, b: any) => b.openNegative - a.openNegative).slice(0, 3).map((h: any) => ({ hotel: h.name, unansweredNegative: h.openNegative })),
        hotelsBiggestRatingDrop: [...dash.byHotel].filter((h: any) => h.delta != null && h.delta < 0).sort((a: any, b: any) => a.delta - b.delta).slice(0, 3).map((h: any) => ({ hotel: h.name, avg10: h.avg10, change: h.delta })),
        hotelsLowestRating: [...dash.byHotel].filter((h: any) => h.avg10 != null && h.count >= 10).sort((a: any, b: any) => a.avg10 - b.avg10).slice(0, 3).map((h: any) => ({ hotel: h.name, avg10: h.avg10, reviews: h.count })),
        note: 'negativeSharePct and responseRatePct changes are in percentage points',
        countries: dash.countries.items.slice(0, 6).map((c: any) => ({ country: countryName(c.code), reviews: c.count, avg10: c.avg10, negativePct: c.negativeShare })),
      });
      if (summary) {
        pdf.section(t.summary, undefined, 70);
        pdf.note(summary);
      }
    }

    // динамика: текущий период против предыдущего
    const g = dash.series.granularity as 'day' | 'week' | 'month';
    const lab = (b: string) => {
      const [y, m, d] = b.split('-');
      return g === 'month' ? `${m}.${y.slice(2)}` : `${d}.${m}`;
    };
    const labels = dash.series.points.map((p: any) => lab(p.bucket));
    const prevPts = dash.prevSeries?.points || [];
    pdf.section(t.trend, t.trendSub, 200);
    pdf.legend([
      { label: t.current, color: INK },
      { label: t.previous, color: PREV, dashed: true },
    ]);
    pdf.lineChart(labels, [
      { values: dash.series.points.map((_: any, i: number) => prevPts[i]?.avg10 ?? null), color: PREV, dashed: true, width: 1.4 },
      { values: dash.series.points.map((p: any) => p.avg10), color: INK },
    ], 150, negBelow);
    pdf.section(t.counts, t.countsSub, 140);
    pdf.barChart(labels, dash.series.points.map((p: any) => p.count), dash.series.points.map((_: any, i: number) => prevPts[i]?.count ?? 0));

    for (const [cmp, ttl] of [[cmpHotels, t.cmpHotels], [cmpPlatforms, t.cmpPlatforms]] as const) {
      if (!cmp || cmp.items.length < 2) continue;
      pdf.section(ttl, t.cmpSub, 220);
      const items = cmp.items.map((it, i) => ({
        ...it,
        color: cmp.dim === 'platform' ? PLATFORM_COLOR[it.key] || SERIES[i % SERIES.length] : SERIES[i % SERIES.length],
        name: cmp.dim === 'platform' ? PLATFORM_LABEL[it.key] || it.key : it.label,
      }));
      pdf.legend(items.map((it) => ({ label: it.name, color: it.color, extra: `${pdf.num(it.avg10)} · ${it.count}` })));
      pdf.lineChart(items[0].points.map((p) => lab(p.bucket)), items.map((it) => ({ values: it.points.map((p) => p.avg10), color: it.color, width: 1.6 })), 160, negBelow);
    }

    // площадки
    if (dash.byPlatform.length) {
      pdf.section(t.byPlatform, undefined, 90);
      // «на площадке» (счётчик самой площадки) есть не у всех скрейперов — пустую колонку не показываем
      const withPlatformCount = dash.byPlatform.some((p: any) => p.platformCount != null);
      const cols: Array<{ label: string; w: number; align?: 'left' | 'right' }> = [{ label: t.colPlatform, w: 3 }, { label: t.colCount, w: 1.4, align: 'right' }, { label: t.colAvg, w: 1.4, align: 'right' }, { label: t.colNeg, w: 1.4, align: 'right' }, { label: t.colResp, w: 1.6, align: 'right' }];
      if (withPlatformCount) cols.push({ label: t.colOnPlatform, w: 2, align: 'right' });
      pdf.table(
        cols,
        dash.byPlatform.map((p: any) => [
          PLATFORM_LABEL[p.platform] || p.platform,
          String(p.count),
          { s: pdf.num(p.avg10), color: p.avg10 != null && p.avg10 < negBelow ? BAD : INK, font: 'SB' },
          p.negativeShare != null ? `${pdf.num(p.negativeShare, 1)}%` : '—',
          REPLY_MODE[p.platform as keyof typeof REPLY_MODE] === 'none' ? { s: t.noReply, color: FAINT } : p.responseRate != null ? `${pdf.num(p.responseRate, 1)}%` : '—',
          ...(withPlatformCount ? [p.platformCount != null ? `${p.platformCount}${p.platformRating != null ? ` · ★ ${pdf.num(p.platformRating, 1)}` : ''}` : '—'] : []),
        ]),
      );
    }

    // отели
    if (dash.byHotel.length > 1 || hotelIds.length === 1) {
      pdf.section(t.byHotel, undefined, 90);
      pdf.table(
        [{ label: t.colHotel, w: 3.6 }, { label: t.colIndex, w: 1.2, align: 'right' }, { label: t.colAvg, w: 1.2, align: 'right' }, { label: t.colDelta, w: 1, align: 'right' }, { label: t.colCount, w: 1.1, align: 'right' }, { label: t.colNeg, w: 1.1, align: 'right' }, { label: t.colOpen, w: 1.5, align: 'right' }, { label: t.colTop, w: 2.4 }],
        dash.byHotel.map((h: any) => [
          h.name,
          pdf.num(h.reputationIndex, 1),
          { s: pdf.num(h.avg10), color: h.avg10 != null && h.avg10 < negBelow ? BAD : INK, font: 'SB' },
          h.delta == null ? '—' : { s: `${h.delta > 0 ? '+' : h.delta < 0 ? '−' : ''}${pdf.num(Math.abs(h.delta))}`, color: h.delta > 0 ? GOOD : h.delta < 0 ? BAD : MUTED },
          String(h.count),
          h.negativeShare != null ? `${pdf.num(h.negativeShare, 1)}%` : '—',
          h.openNegative ? { s: String(h.openNegative), color: BAD, font: 'SB' } : '0',
          h.topComplaint ? `${topicName(h.topComplaint)} · ${h.topComplaint.count}` : '—',
        ]),
      );
    }

    // темы
    pdf.section(`${t.complaints} / ${t.praises}`, undefined, 120);
    pdf.twoBars(
      {
        title: t.complaints,
        color: BAD,
        rows: dash.complaints.slice(0, 8).map((c: any) => {
          const d = c.negative - c.prevNegative;
          return { label: topicName(c), v: c.negative, extra: d ? { s: `${d > 0 ? '+' : '−'}${Math.abs(d)}`, color: d > 0 ? BAD : GOOD } : null };
        }),
      },
      { title: t.praises, color: GOOD, rows: dash.praises.slice(0, 8).map((c: any) => ({ label: topicName(c), v: c.positive })) },
    );
    const quotes = dash.complaints.slice(0, 4).flatMap((c: any) => (c.negQuotes || []).slice(0, 1).map((q: string) => ({ q, topic: topicName(c) })));
    if (quotes.length) {
      pdf.section(t.quotes, undefined, 80);
      for (const x of quotes) pdf.quote(x.q, x.topic);
    }

    // страны
    const countries = dash.countries.items.slice(0, 12);
    if (countries.length) {
      pdf.section(t.countries, t.countriesSub, 120);
      const maxNeg = Math.max(1, ...countries.map((c: any) => c.negative));
      pdf.table(
        [{ label: t.colCountry, w: 3.4 }, { label: t.colCount, w: 1.2, align: 'right' }, { label: t.colAvg, w: 1.2, align: 'right' }, { label: t.colNeg, w: 1.3, align: 'right' }, { label: '', w: 2.4 }],
        countries.map((c: any) => [
          countryName(c.code),
          String(c.count),
          { s: pdf.num(c.avg10), color: c.avg10 != null && c.avg10 < negBelow ? BAD : INK, font: 'SB' },
          c.negativeShare != null ? `${pdf.num(c.negativeShare, 1)}% · ${c.negative}` : '—',
          { s: '', bar: c.negative / maxNeg, color: BAD },
        ]),
      );
    }

    // конкуренты (если клиент их добавил): по каждому отелю среза, не больше трёх отелей
    if (await this.competitors.hasAny(tenantId)) {
      const cmp = await this.competitors.compare(tenantId, q);
      for (const h of cmp.hotels.slice(0, 3)) {
        const plats = h.platforms.map((p: string) => PLATFORM_LABEL[p] || p).join(', ');
        pdf.section(`${t.compTitle} · ${h.name}`, t.compSub.replace('{p}', plats), 150);
        const onSite = (list: Array<{ platform: string; rating: number | null; count: number | null }>) =>
          list.filter((x) => x.rating != null).map((x) => `${PLATFORM_LABEL[x.platform] || x.platform} ${pdf.num(x.rating, 1)}${x.count != null ? ` (${x.count})` : ''}`).join(' · ') || '—';
        const row = (name: string, x: any, bold: boolean, site: string) => [
          { s: name, font: bold ? 'B' : 'M' },
          { s: pdf.num(x.avg10), color: x.avg10 != null && x.avg10 < negBelow ? BAD : INK, font: 'SB' },
          x.delta == null ? '—' : { s: `${x.delta > 0 ? '+' : x.delta < 0 ? '−' : ''}${pdf.num(Math.abs(x.delta))}`, color: x.delta > 0 ? GOOD : x.delta < 0 ? BAD : MUTED },
          String(x.count),
          x.negativeShare != null ? `${pdf.num(x.negativeShare, 1)}%` : '—',
          { s: site, color: MUTED },
        ];
        pdf.table(
          [{ label: t.colHotel, w: 3.2 }, { label: t.colAvg, w: 1.1, align: 'right' }, { label: t.colDelta, w: 1, align: 'right' }, { label: t.colCount, w: 1, align: 'right' }, { label: t.colNeg, w: 1.1, align: 'right' }, { label: t.colOnSite, w: 3.2 }],
          [row(`${t.compUs} — ${h.name}`, h.ours, true, '—'), ...h.competitors.map((c: any) => row(c.name, c, false, onSite(c.platforms)))],
        );
        if (h.rank != null) pdf.note(t.compRank.replace('{r}', String(h.rank)).replace('{n}', String(h.rankOf)));
        if (h.losing.length || h.winning.length) {
          // полоса — разрыв в п.п.; в подписи — доля жалоб у нас / у конкурентов
          const fmtRow = (x: any) => ({
            label: x.basis === 'praise'
              ? `${topicName(x)} · ${t.compPraise} ${Math.round(x.oursPosPct ?? 0)}% / ${Math.round(x.theirsPosPct ?? 0)}%`
              : `${topicName(x)} · ${t.compComplaints} ${Math.round(x.oursNegPct ?? 0)}% / ${Math.round(x.theirsNegPct ?? 0)}%`,
            v: Math.round(Math.abs(x.gap ?? 0)),
            extra: null,
          });
          pdf.twoBars({ title: t.compLose, color: BAD, rows: h.losing.map(fmtRow) }, { title: t.compWin, color: GOOD, rows: h.winning.map(fmtRow) });
          pdf.text(t.compTopicNote, M, pdf.y - 2, { size: 7.5, color: FAINT, width: CW });
          pdf.y += 12;
        } else if (h.topicsBase.ours < h.topicsBase.min || h.topicsBase.theirs < h.topicsBase.min) {
          pdf.text(t.compFew.replace('{n}', String(h.topicsBase.min)), M, pdf.y, { size: 8.5, color: FAINT, width: CW });
          pdf.y += 16;
        }
      }
    }

    // негатив без ответа
    if (open.items.length) {
      pdf.section(`${t.open} · ${open.total}`, undefined, 100);
      for (const r of open.items as any[]) {
        const text = [r.title, r.text].filter(Boolean).join('. ').replace(/\s+/g, ' ').slice(0, 320);
        pdf.quote(text || '—', `${hotelName(r.hotelId)} · ${PLATFORM_LABEL[r.platform] || r.platform} · ${pdf.date(r.publishedAt)} · ${pdf.num(r.rating10, 1)} / 10${r.author ? ` · ${r.author}` : ''}`);
      }
    }

    pdf.footer(`${brandName} · ${t.kicker} · ${title}`.slice(0, 120));
    const buffer = await pdf.finish();
    const stamp = new Date().toISOString().slice(0, 10);
    return { buffer, filename: `reputation-report-${stamp}.pdf`, title, period: periodLine };
  }

  async send(tenantId: string, req: ReportRequest & { emails?: string[]; message?: string }) {
    const emails = [...new Set((req.emails || []).map((e) => String(e).trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))].slice(0, 10);
    if (!emails.length) throw new BadRequestException('At least one valid email is required');
    const lang = this.lang(req.lang);
    const t = T[lang];
    const { buffer, filename, title, period } = await this.build(tenantId, req);
    // ссылка — в CRM клиента (его домен, если подключён), подпись — его название
    const branding = await tenantBranding((sql, p) => this.hotels.query(sql, p), tenantId);
    const frontend = branding.frontend;
    const e = escapeMailHtml;
    const html = renderMailShell({
      headline: `${t.mailSubject} · ${e(title)}`,
      bodyHtml: `<p style="margin:0 0 10px">${e(t.mailText)}:</p><p style="margin:0 0 14px;color:#666">${e(period)}</p>${
        req.message?.trim() ? `<p style="margin:0 0 6px;white-space:pre-wrap">${e(req.message.trim().slice(0, 2000))}</p>` : ''
      }`,
      cta: { label: t.mailOpen, href: `${frontend}/hotels/reviews/dashboard` },
      footerHtml: `© ${new Date().getFullYear()} ${escapeMailHtml(branding.name?.trim() || 'Lumiva CRM')}`,
    });
    const results: Array<{ email: string; ok: boolean; error?: string }> = [];
    for (const to of emails) {
      const r = await this.mail.sendMailNow({
        to,
        subject: `${t.mailSubject} · ${title}`,
        html,
        attachments: [{ filename, content: buffer.toString('base64'), contentType: 'application/pdf' }],
      });
      results.push(r.ok ? { email: to, ok: true } : { email: to, ok: false, error: r.error });
      if (!r.ok) this.log.warn(`reputation report to ${to}: ${r.error}`);
    }
    return { sent: results.filter((r) => r.ok).length, results };
  }
}
