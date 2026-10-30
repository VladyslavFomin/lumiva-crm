import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import ExcelJS from 'exceljs';
import { HotelReservation, type HotelReservationGuest } from './hotel-reservation.entity';
import { HotelRoomUnit } from './hotel-room-unit.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { Hotel } from './hotel.entity';
import { normalizeCountry } from '../common/countries';

export type GuestRegisterMode = 'inhouse' | 'arrivals' | 'departures';
/** kbs — Турция (Kimlik Bildirim Sistemi), mvd — Россия (миграционный учёт) */
export type GuestRegisterRegime = 'kbs' | 'mvd';
export type GuestIssue =
  | 'no_manifest'
  | 'missing_name'
  | 'missing_nationality'
  | 'missing_document'
  | 'missing_birthdate'
  | 'missing_gender'
  | 'missing_tckn'
  | 'invalid_tckn'
  | 'missing_parents'
  | 'document_expired'
  | 'missing_birthplace'
  | 'missing_issue_date'
  | 'missing_migration_card'
  | 'missing_entry_purpose';

export type GuestRegisterRow = {
  reservationId: string;
  guestId: string | null;
  hotelId: string;
  roomType: string | null;
  room: string | null;
  checkIn: string;
  checkOut: string;
  status: string;
  firstName: string;
  lastName: string;
  fullName: string;
  nationality: string | null;
  documentType: string | null;
  documentNumber: string;
  documentExpiry: string | null;
  birthDate: string | null;
  gender: string | null;
  tcKimlikNo: string | null;
  fatherName: string | null;
  motherName: string | null;
  reportedAt: string | null;
  birthPlace: string | null;
  documentIssueDate: string | null;
  migrationCard: string | null;
  visaNumber: string | null;
  entryPurpose: string | null;
  /** МВД: подать уведомление не позже (1 рабочий день после заезда) */
  deadline: string | null;
  issues: GuestIssue[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Граждане ЕАЭС-партнёра Беларуси въезжают без миграционной карты */
const NO_MIGRATION_CARD = new Set(['BY']);

/** Россия по свободному тексту страны отеля */
export function isRussia(country: string | null | undefined): boolean {
  return /^(ru|rus|russia|россия|российская федерация|рф)$/i.test(String(country || '').trim());
}

/** Следующий рабочий день (сб/вс пропускаются; праздники не учитываются). */
function nextWorkingDay(d: string): string {
  const x = new Date(`${d}T00:00:00Z`);
  do x.setUTCDate(x.getUTCDate() + 1);
  while (x.getUTCDay() === 0 || x.getUTCDay() === 6);
  return x.toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);

/** T.C. Kimlik No: 11 цифр, первая не 0, 10-я и 11-я — контрольные. */
export function isValidTckn(v: string | null | undefined): boolean {
  const s = String(v || '').trim();
  if (!/^[1-9]\d{10}$/.test(s)) return false;
  const d = s.split('').map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const c10 = (((odd * 7 - even) % 10) + 10) % 10;
  const c11 = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
  return d[9] === c10 && d[10] === c11;
}

/** «Ivan Petrov» → имя/фамилия: фамилия — последнее слово (паспортные имена в CRM пишутся «Имя Фамилия»). */
function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: parts[0] || '', last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

/**
 * Журнал гостей для уведомления полиции (Турция — KBS, закон 1774; Россия — МВД): кто в отеле / заезжает /
 * выезжает на дату, с проверкой полноты данных каждого гостя. Прямой передачи в KBS нет (нужна авторизация
 * разработчика в EGM) — выгрузка Excel и отметка «передано».
 */
@Injectable()
export class HotelGuestRegisterService {
  constructor(
    @InjectRepository(HotelReservation) private readonly reservations: Repository<HotelReservation>,
    @InjectRepository(HotelRoomUnit) private readonly units: Repository<HotelRoomUnit>,
    @InjectRepository(HotelRoomType) private readonly roomTypes: Repository<HotelRoomType>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
  ) {}

  private issuesOf(g: HotelReservationGuest | null, nationality: string | null, onDate: string, regime: GuestRegisterRegime): GuestIssue[] {
    if (!g) return ['no_manifest'];
    const out: GuestIssue[] = [];
    const name = splitName(g.fullName || '');
    if (!name.first || !name.last) out.push('missing_name');
    if (!nationality) out.push('missing_nationality');
    if (!g.birthDate) out.push('missing_birthdate');
    if (!g.gender) out.push('missing_gender');
    if (regime === 'mvd') {
      if (!g.passportNumber) out.push('missing_document');
      if (g.passportExpiry && g.passportExpiry < onDate) out.push('document_expired');
      if (nationality && nationality !== 'RU') {
        if (!g.birthPlace) out.push('missing_birthplace');
        if (!g.documentIssueDate) out.push('missing_issue_date');
        if (!NO_MIGRATION_CARD.has(nationality) && !g.migrationCard) out.push('missing_migration_card');
        if (!g.entryPurpose) out.push('missing_entry_purpose');
      }
      return out;
    }
    if (nationality === 'TR') {
      if (!g.tcKimlikNo) out.push('missing_tckn');
      else if (!isValidTckn(g.tcKimlikNo)) out.push('invalid_tckn');
      if (!g.fatherName || !g.motherName) out.push('missing_parents');
    } else {
      if (!g.passportNumber) out.push('missing_document');
      if (g.passportExpiry && g.passportExpiry < onDate) out.push('document_expired');
    }
    return out;
  }

  async list(tenantId: string, q: { hotelId?: string; date?: string; mode?: string; regime?: string }) {
    const date = q.date && DATE_RE.test(q.date) ? q.date : today();
    const mode: GuestRegisterMode = q.mode === 'arrivals' || q.mode === 'departures' ? q.mode : 'inhouse';
    let regime: GuestRegisterRegime = q.regime === 'mvd' ? 'mvd' : 'kbs';
    if (!q.regime && q.hotelId) {
      const h = await this.hotels.findOne({ where: { id: q.hotelId, tenantId }, select: ['id', 'country'] });
      if (isRussia(h?.country)) regime = 'mvd';
    }
    const qb = this.reservations.createQueryBuilder('r').where('r.tenantId = :tenantId', { tenantId }).andWhere("r.status NOT IN ('cancelled','no_show')");
    if (q.hotelId) qb.andWhere('r.hotelId = :hotelId', { hotelId: q.hotelId });
    if (mode === 'arrivals') qb.andWhere('r.checkIn = :date', { date });
    else if (mode === 'departures') qb.andWhere('r.checkOut = :date', { date });
    else qb.andWhere('r.checkIn <= :date AND r.checkOut > :date', { date });
    const res = await qb.orderBy('r.checkIn', 'ASC').addOrderBy('r.guestName', 'ASC').getMany();

    const unitIds = res.map((r) => r.roomUnitId).filter((x): x is string => !!x);
    const [units, types] = await Promise.all([
      unitIds.length ? this.units.find({ where: { tenantId, id: In(unitIds) } }) : Promise.resolve([]),
      res.length ? this.roomTypes.find({ where: { tenantId, id: In([...new Set(res.map((r) => r.roomTypeId))]) } }) : Promise.resolve([]),
    ]);
    const unitLabel = new Map(units.map((u) => [u.id, u.label]));
    const typeName = new Map(types.map((t) => [t.id, t.name]));

    const rows: GuestRegisterRow[] = [];
    for (const r of res) {
      const guests: Array<HotelReservationGuest | null> = r.guests?.length ? r.guests : [null];
      for (const g of guests) {
        const full = (g?.fullName || r.guestName || '').trim();
        const name = splitName(full);
        const nationality = normalizeCountry(g?.nationalityCode) || normalizeCountry(g?.citizenship) || (guests.length === 1 ? r.guestCountry : null);
        rows.push({
          reservationId: r.id,
          guestId: g?.id ?? null,
          hotelId: r.hotelId,
          roomType: typeName.get(r.roomTypeId) || null,
          room: r.roomUnitId ? unitLabel.get(r.roomUnitId) || null : null,
          checkIn: r.checkIn,
          checkOut: r.checkOut,
          status: r.status,
          firstName: name.first,
          lastName: name.last,
          fullName: full,
          nationality,
          documentType: g?.documentType || (g?.passportNumber ? 'passport' : null),
          documentNumber: g?.passportNumber || '',
          documentExpiry: g?.passportExpiry || null,
          birthDate: g?.birthDate || null,
          gender: g?.gender || null,
          tcKimlikNo: g?.tcKimlikNo || null,
          fatherName: g?.fatherName || null,
          motherName: g?.motherName || null,
          reportedAt: g?.kbsReportedAt || null,
          birthPlace: g?.birthPlace || null,
          documentIssueDate: g?.documentIssueDate || null,
          migrationCard: g?.migrationCard || null,
          visaNumber: g?.visaNumber || null,
          entryPurpose: g?.entryPurpose || null,
          deadline: regime === 'mvd' ? nextWorkingDay(r.checkIn) : null,
          issues: this.issuesOf(g, nationality, date, regime),
        });
      }
    }
    const summary = {
      guests: rows.length,
      ready: rows.filter((x) => !x.issues.length).length,
      withIssues: rows.filter((x) => x.issues.length).length,
      reported: rows.filter((x) => x.reportedAt).length,
      foreigners: rows.filter((x) => x.nationality && x.nationality !== (regime === 'mvd' ? 'RU' : 'TR')).length,
      overdue: regime === 'mvd' ? rows.filter((x) => !x.reportedAt && x.deadline && x.deadline < today()).length : 0,
    };
    return { date, mode, regime, rows, summary };
  }

  /** Отметить гостей переданными (или снять отметку). items: [{reservationId, guestId}] */
  async markReported(tenantId: string, items: Array<{ reservationId: string; guestId: string | null }>, reported = true) {
    if (!Array.isArray(items) || !items.length) throw new BadRequestException('Не выбраны гости');
    const ids = [...new Set(items.map((i) => i.reservationId))].slice(0, 500);
    const list = await this.reservations.find({ where: { tenantId, id: In(ids) } });
    const stamp = reported ? new Date().toISOString() : null;
    let marked = 0;
    for (const r of list) {
      const wanted = new Set(items.filter((i) => i.reservationId === r.id).map((i) => i.guestId));
      if (!r.guests?.length) continue; // без журнала гостей отмечать некого
      r.guests = r.guests.map((g) => {
        if (!wanted.has(g.id)) return g;
        marked++;
        return { ...g, kbsReportedAt: stamp };
      });
      await this.reservations.update({ id: r.id, tenantId }, { guests: r.guests });
    }
    return { marked };
  }

  async exportXlsx(tenantId: string, q: { hotelId?: string; date?: string; mode?: string; regime?: string }) {
    const data = await this.list(tenantId, q);
    const hotel = q.hotelId ? await this.hotels.findOne({ where: { id: q.hotelId, tenantId } }) : null;
    const wb = new ExcelJS.Workbook();
    if (data.regime === 'mvd') {
      // поля уведомления о прибытии иностранного гражданина (и регистрации граждан РФ по месту пребывания)
      const ws = wb.addWorksheet('МВД');
      ws.columns = [
        { header: 'Фамилия', key: 'lastName', width: 18 },
        { header: 'Имя', key: 'firstName', width: 18 },
        { header: 'Гражданство', key: 'nationality', width: 12 },
        { header: 'Дата рождения', key: 'birthDate', width: 13 },
        { header: 'Пол', key: 'gender', width: 6 },
        { header: 'Место рождения', key: 'birthPlace', width: 20 },
        { header: 'Вид документа', key: 'documentType', width: 14 },
        { header: 'Серия и номер документа', key: 'documentNumber', width: 18 },
        { header: 'Дата выдачи', key: 'documentIssueDate', width: 12 },
        { header: 'Срок действия', key: 'documentExpiry', width: 12 },
        { header: 'Миграционная карта', key: 'migrationCard', width: 18 },
        { header: 'Виза', key: 'visaNumber', width: 14 },
        { header: 'Цель въезда', key: 'entryPurpose', width: 12 },
        { header: 'Номер комнаты', key: 'room', width: 10 },
        { header: 'Дата прибытия', key: 'checkIn', width: 12 },
        { header: 'Дата убытия', key: 'checkOut', width: 12 },
        { header: 'Подать до', key: 'deadline', width: 12 },
        { header: 'Не хватает', key: 'issues', width: 30 },
      ];
      ws.getRow(1).font = { bold: true };
      const docType: Record<string, string> = { passport: 'Паспорт', id_card: 'Удостоверение личности', other: 'Иной документ' };
      const purpose: Record<string, string> = { tourism: 'Туризм', business: 'Деловая', private: 'Частная', work: 'Работа', study: 'Учёба', other: 'Иная' };
      for (const r of data.rows) {
        ws.addRow({
          ...r,
          documentType: docType[r.documentType || ''] || '',
          gender: r.gender === 'M' ? 'М' : r.gender === 'F' ? 'Ж' : '',
          entryPurpose: purpose[r.entryPurpose || ''] || '',
          issues: r.issues.join(', '),
        });
      }
      const buffer = Buffer.from(await wb.xlsx.writeBuffer());
      const name = `mvd-${(hotel?.name || 'hotels').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}-${data.mode}-${data.date}.xlsx`;
      return { buffer, name };
    }
    const ws = wb.addWorksheet('KBS');
    ws.columns = [
      { header: 'Adı', key: 'firstName', width: 18 },
      { header: 'Soyadı', key: 'lastName', width: 18 },
      { header: 'Uyruğu', key: 'nationality', width: 9 },
      { header: 'T.C. Kimlik No', key: 'tcKimlikNo', width: 15 },
      { header: 'Belge Türü', key: 'documentType', width: 12 },
      { header: 'Belge No', key: 'documentNumber', width: 15 },
      { header: 'Doğum Tarihi', key: 'birthDate', width: 13 },
      { header: 'Cinsiyet', key: 'gender', width: 9 },
      { header: 'Baba Adı', key: 'fatherName', width: 14 },
      { header: 'Ana Adı', key: 'motherName', width: 14 },
      { header: 'Oda No', key: 'room', width: 9 },
      { header: 'Giriş Tarihi', key: 'checkIn', width: 12 },
      { header: 'Çıkış Tarihi', key: 'checkOut', width: 12 },
      { header: 'Eksik bilgi', key: 'issues', width: 30 },
    ];
    ws.getRow(1).font = { bold: true };
    const docType: Record<string, string> = { passport: 'Pasaport', id_card: 'Kimlik Kartı', other: 'Diğer' };
    const gender: Record<string, string> = { M: 'Erkek', F: 'Kadın' };
    for (const r of data.rows) {
      ws.addRow({
        ...r,
        documentType: r.nationality === 'TR' ? 'T.C. Kimlik' : docType[r.documentType || ''] || '',
        gender: gender[r.gender || ''] || '',
        issues: r.issues.join(', '),
      });
    }
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const name = `kbs-${(hotel?.name || 'hotels').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}-${data.mode}-${data.date}.xlsx`;
    return { buffer, name };
  }
}
